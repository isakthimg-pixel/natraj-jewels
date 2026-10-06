NATRAJ JEWELS SHOP TOOLS
========================

One website with all the shop's small apps, sharing one online database
(Supabase project "natraj-tools", Mumbai) and one sign-in.

  index.html       home: sign in, then a tile for each app you can use
  attendance/      daily attendance, leave requests, monthly register
  people/          owner: who can sign in, app access, staff list, settings
  dashboard/       owner: today at a glance, leave waiting, month totals
  shared/          design and sign-in code used by every page
  img/             logo and texture
  supabase/        database changes and server code, kept for the record
                   (the upload zip leaves it out; nothing in it is secret)

PUT IT ONLINE (Netlify, free)
  1. Go to https://app.netlify.com/drop and sign in.
  2. Drag the "tools" folder onto the page.
  3. Site configuration > Change site name, e.g. natraj-tools
     -> https://natraj-tools.netlify.app
  To update later: Deploys > drag the new folder onto it. Records are not
  affected; they live in the database.

FIRST TIME
  1. Open the address and tap "Set up the owner": your name and a 6-digit PIN.
     Write down the recovery code it shows.
  2. People & settings > Add a person: name, PIN, and which apps they can use.
  3. On phones: Share > Add to Home Screen.

SIGN-IN
  Everyone signs in with their name and their own 6-digit PIN.
  The app signs out after 5 minutes without use.
  Anyone can send a leave request without signing in.

BACKUP
  Dashboard or People & settings > Download everything, once a week.
