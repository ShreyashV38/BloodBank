# Blood Bank System: Pre\-Deployment Remediation Guide

Follow these steps precisely to secure your application and fix UI bugs before deployment\.

## Step 1: Fix the Back/Forward Browser Cache Bug

__File:__ server\.js

We need to add HTTP headers that strictly forbid the browser from caching secure pages\. Add this middleware __above__ your Auth Guard middleware in server\.js:

// ΓöÇΓöÇ Prevent Browser Caching \(Fixes Back/Forward Navigation Bug\) ΓöÇΓöÇ  
app\.use\(\(req, res, next\) => \{  
    // Only apply to HTML pages, not static assets like CSS/JS  
    if \(\!req\.path\.startsWith\('/css/'\) && \!req\.path\.startsWith\('/js/'\) && \!req\.path\.startsWith\('/images/'\)\) \{  
        res\.setHeader\('Cache\-Control', 'no\-store, no\-cache, must\-revalidate, private'\);  
        res\.setHeader\('Pragma', 'no\-cache'\);  
        res\.setHeader\('Expires', '\-1'\);  
    \}  
    next\(\);  
\}\);  


## Step 2: Fix Session Fixation \(CRITICAL\)

__File:__ routes/auth\.js

When a user successfully verifies their OTP, you must generate a brand new session ID\. Find the POST /verify\-login\-otp route, and replace the session assignment part with this:

// Find this part in POST /verify\-login\-otp:  
// req\.session\.userId = pending\.userId;  
// req\.session\.username = pending\.username;  
// \.\.\.  
  
// REPLACE IT WITH THIS:  
req\.session\.regenerate\(\(err\) => \{  
    if \(err\) \{  
        console\.error\('Session regeneration error:', err\);  
        return res\.status\(500\)\.send\('Server error during login\.'\);  
    \}  
      
    // Now attach data to the newly secured session ID  
    req\.session\.userId = pending\.userId;  
    req\.session\.username = pending\.username;  
    req\.session\.fullName = pending\.fullName;  
    req\.session\.role = pending\.role;  
      
    if \(pending\.role === 'Super Admin' || pending\.role === 'Staff'\) \{  
        req\.session\.adminId = pending\.userId;  
    \}  
  
    res\.redirect\(\_portalFor\(pending\.role\)\);  
\}\);  


## Step 3: Fix Input Sanitization \(CRITICAL\)

Your current regex can be bypassed easily\. Let's use a real HTML sanitizer\.

__1\. Install the library in your terminal:__

npm install sanitize\-html

__2\. Update the file:__ middleware/security\.js

import sanitizeHtml from 'sanitize\-html'; // Add this at the top  
  
// Replace your old sanitizeBody function with this:  
export function sanitizeBody\(req, res, next\) \{  
    if \(req\.body && typeof req\.body === 'object'\) \{  
        for \(const key of Object\.keys\(req\.body\)\) \{  
            if \(typeof req\.body\[key\] === 'string'\) \{  
                // Strip all HTML tags securely  
                req\.body\[key\] = sanitizeHtml\(req\.body\[key\], \{  
                    allowedTags: \[\],       // Don't allow any HTML tags  
                    allowedAttributes: \{\}  // Don't allow any HTML attributes  
                \}\)\.trim\(\);  
            \}  
        \}  
    \}  
    next\(\);  
\}  


## Step 4: Fix the Name Validation Bug

__File:__ middleware/validators\.js

Currently, people with names like D'Souza or Anne\-Marie cannot sign up\.

Find the validateSignup array, and update the full\_name regex:

// Change this line:  
\.matches\(/^\[a\-zA\-Z\\s\.\]\+$/\)\.withMessage\('Name can only contain letters, spaces, and periods\.'\),  
  
// To this line:  
\.matches\(/^\[a\-zA\-Z\\s\.\\\-'\]\+$/\)\.withMessage\('Name can only contain letters, spaces, periods, hyphens, and apostrophes\.'\),  


*\(Do the same for donor, hospital, and admin validators where you validate names\)\.*

## Step 5: Fix Content Security Policy \(CSP\)

__File:__ middleware/security\.js

To actually prevent Cross\-Site Scripting \(XSS\), remove 'unsafe\-inline' from scriptSrc if possible\. If you are using inline <script> tags in your EJS files, you should move that JS into external files in your public/js/ folder\.

// In helmetMiddleware:  
scriptSrc: \["'self'", "\[https://cdn\.jsdelivr\.net\]\(https://cdn\.jsdelivr\.net\)"\], // Removed 'unsafe\-inline'  


*Note: If your app breaks after removing 'unsafe\-inline', it means you have <script> tags written directly inside your \.ejs files\. Move them to external \.js files and link them via <script src="/js/yourfile\.js"></script>\.*

## Step 6: Hardcoded Secret Safety

__File:__ server\.js

Ensure your app doesn't accidentally boot up in production with a weak secret\. Update your session config:

const sessionSecret = process\.env\.SESSION\_SECRET;  
if \(\!sessionSecret && process\.env\.NODE\_ENV === 'production'\) \{  
    console\.error\('FATAL ERROR: SESSION\_SECRET environment variable is missing\.'\);  
    process\.exit\(1\); // Crash the app immediately  
\}  
  
app\.use\(session\(\{  
    secret: sessionSecret || 'bloodbank\_goa\_secret\_CHANGE\_ME\_DEV\_ONLY',  
    // \.\.\. rest of your session config  


