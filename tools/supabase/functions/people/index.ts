// "people" edge function: the only place sign-in accounts are created or changed.
// Everyone signs in with their name and a 6-digit PIN. Behind the scenes each person is a
// Supabase Auth user with a made-up email (<username>@staff.natraj-tools.app) and a password
// derived from the PIN. Only the owner can add, change or remove people.
//
// Actions (POST JSON {action, ...}):
//   setup        {name, pin}                         first owner, only while no owner exists
//   add          {name, pin, is_owner, apps, staff_id} owner only
//   update       {user_id, name?, pin?, is_owner?, apps?, staff_id?}  owner only
//   remove       {user_id}                           owner only
//   new_recovery {}                                  owner only: new recovery code for the caller
//   recover      {code, pin}                         owner who forgot their PIN (or lost their phone) sets a new
//                                                    PIN; this also switches off their two-step sign-in
//   update also takes {two_step_off: true} to switch off someone's two-step sign-in (lost phone)
// Someone who has set up two-step sign-in must have typed its code in this session (aal2) to use these.
import { createClient } from "npm:@supabase/supabase-js@2.117.2";

const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const APPS = ["attendance", "rates", "todo", "expenses", "banking", "crm", "designs", "chits", "silver", "campaigns", "jobs"]; // grows as new apps are added
const PIN = /^\d{6}$/;
const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-natraj-device",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });
const fail = (error: string, status = 400) => json({ error }, status);

const emailFor = (username: string) => `${username}@staff.natraj-tools.app`;
const passwordFor = (pin: string) => `natraj-${pin}`;

async function sha256(text: string) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}
const recoveryHash = (code: string) => sha256("natraj-recovery|" + code.toUpperCase().replace(/[^A-Z0-9]/g, ""));
function newCode() {
  const abc = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const r = crypto.getRandomValues(new Uint32Array(8));
  const c = [...r].map((n) => abc[n % abc.length]).join("");
  return c.slice(0, 4) + "-" + c.slice(4);
}

function cleanName(v: unknown) {
  const s = typeof v === "string" ? v.trim().replace(/\s+/g, " ") : "";
  return s.length >= 1 && s.length <= 60 ? s : null;
}
const cleanApps = (v: unknown) => (Array.isArray(v) ? v.filter((a) => APPS.includes(a)) : []);

async function uniqueUsername(name: string) {
  const base = name.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 30) || "user";
  for (let i = 1; i < 100; i++) {
    const u = i === 1 ? base : `${base}-${i}`;
    const { count } = await admin.from("profiles").select("user_id", { count: "exact", head: true }).eq("username", u);
    if (!count) return u;
  }
  throw new Error("Could not make a sign-in name");
}

async function callerProfile(req: Request) {
  const token = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
  if (!token) return null;
  const { data } = await admin.auth.getUser(token);   // checks the token is real
  if (!data?.user) return null;
  const { data: p } = await admin.from("profiles").select("*").eq("user_id", data.user.id).maybeSingle();
  if (!p) return null;
  let aal = "";
  try { aal = JSON.parse(atob(token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/"))).aal || ""; } catch { /* no claim */ }
  const twoStep = (data.user.factors || []).some((f) => f.status === "verified");
  return { ...p, second_step_missing: twoStep && aal !== "aal2" };
}

async function twoStepOff(userId: string) {
  const { data } = await admin.auth.admin.mfa.listFactors({ userId });
  for (const f of data?.factors || []) await admin.auth.admin.mfa.deleteFactor({ id: f.id, userId });
}

async function ownerCount() {
  const { count } = await admin.from("profiles").select("user_id", { count: "exact", head: true }).eq("is_owner", true);
  return count ?? 0;
}

async function createPerson(name: string, pin: string, isOwner: boolean, apps: string[], staffId: string | null) {
  const username = await uniqueUsername(name);
  const { data, error } = await admin.auth.admin.createUser({
    email: emailFor(username),
    password: passwordFor(pin),
    email_confirm: true,
    user_metadata: { name },
  });
  if (error || !data.user) throw new Error(error?.message || "Could not create the account");
  const { error: e2 } = await admin.from("profiles").insert({
    user_id: data.user.id, name, username, is_owner: isOwner, apps: isOwner ? APPS : apps, staff_id: staffId,
  });
  if (e2) {
    await admin.auth.admin.deleteUser(data.user.id);
    throw new Error(e2.message);
  }
  return { user_id: data.user.id, username };
}

async function setRecovery(userId: string) {
  const code = newCode();
  const { data } = await admin.auth.admin.getUserById(userId);
  await admin.auth.admin.updateUserById(userId, {
    app_metadata: { ...(data?.user?.app_metadata || {}), recovery: await recoveryHash(code) },
  });
  return code;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return fail("Use POST", 405);
  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return fail("Bad request"); }
  const action = body.action;

  try {
    if (action === "setup") {
      if ((await ownerCount()) > 0) return fail("The owner is already set up. Sign in instead.", 409);
      const name = cleanName(body.name);
      if (!name) return fail("Type your name.");
      if (!PIN.test(String(body.pin || ""))) return fail("The PIN must be 6 digits.");
      const p = await createPerson(name, String(body.pin), true, APPS, null);
      return json({ ...p, recovery: await setRecovery(p.user_id) });
    }

    if (action === "recover") {
      if (!PIN.test(String(body.pin || ""))) return fail("The new PIN must be 6 digits.");
      const hash = await recoveryHash(String(body.code || ""));
      const { data: owners } = await admin.from("profiles").select("user_id, username").eq("is_owner", true);
      for (const o of owners || []) {
        const { data } = await admin.auth.admin.getUserById(o.user_id);
        if (data?.user?.app_metadata?.recovery === hash) {
          await admin.auth.admin.updateUserById(o.user_id, { password: passwordFor(String(body.pin)) });
          await twoStepOff(o.user_id);
          return json({ username: o.username });
        }
      }
      return fail("That recovery code is not right.", 403);
    }

    const me = await callerProfile(req);
    if (!me) return fail("Sign in first.", 401);
    if (me.second_step_missing) return fail("Type the code from your authenticator app first.", 403);
    if (!me.is_owner) return fail("Only the owner can do this.", 403);

    if (action === "add") {
      const name = cleanName(body.name);
      if (!name) return fail("Type their name.");
      if (!PIN.test(String(body.pin || ""))) return fail("The PIN must be 6 digits.");
      return json(await createPerson(name, String(body.pin), !!body.is_owner, cleanApps(body.apps),
        typeof body.staff_id === "string" && body.staff_id ? body.staff_id : null));
    }

    if (action === "update" || action === "remove") {
      const id = String(body.user_id || "");
      const { data: target } = await admin.from("profiles").select("*").eq("user_id", id).maybeSingle();
      if (!target) return fail("That person no longer exists.", 404);
      const losingOwner = target.is_owner && (action === "remove" || body.is_owner === false);
      if (losingOwner && (await ownerCount()) <= 1) return fail("Keep at least one owner.", 409);

      if (action === "remove") {
        await admin.auth.admin.deleteUser(id);
        return json({ ok: true });
      }
      const patch: Record<string, unknown> = {};
      if (body.name !== undefined) {
        const name = cleanName(body.name);
        if (!name) return fail("Type their name.");
        patch.name = name;
      }
      if (body.is_owner !== undefined) patch.is_owner = !!body.is_owner;
      if (body.apps !== undefined) patch.apps = cleanApps(body.apps);
      if (body.staff_id !== undefined) patch.staff_id = body.staff_id || null;
      if ((patch.is_owner ?? target.is_owner) === true) patch.apps = APPS;
      if (Object.keys(patch).length) {
        const { error } = await admin.from("profiles").update(patch).eq("user_id", id);
        if (error) return fail(error.message);
      }
      if (body.pin !== undefined) {
        if (!PIN.test(String(body.pin))) return fail("The PIN must be 6 digits.");
        await admin.auth.admin.updateUserById(id, { password: passwordFor(String(body.pin)) });
      }
      if (body.two_step_off === true) await twoStepOff(id);
      return json({ ok: true });
    }

    if (action === "new_recovery") return json({ recovery: await setRecovery(me.user_id) });

    return fail("Unknown action.");
  } catch (e) {
    return fail(e instanceof Error ? e.message : "Something went wrong.", 500);
  }
});
