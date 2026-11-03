# AGENTS.md — Antigravity Instructions for Nexa CRM / Dr. Terrace

## 0. PURPOSE

You are the coding agent for this repository.

Your primary goal is **correctness and preservation of existing behavior**, not speed or large refactors.

This project is a production-oriented React Native application built with:

- Expo SDK 58
- React Native 0.86.3
- React 19.2.3
- Expo Router
- JavaScript / JSX, with strict TypeScript configuration
- Axios
- AsyncStorage
- React Native Paper
- Expo Image / Image Picker / Image Manipulator
- EAS builds
- Feature-oriented source architecture

The repository already contains significant working functionality. Treat existing code as intentional unless there is clear evidence that it is broken.

---

# 1. NON-NEGOTIABLE RULES

## 1.1 Never guess when the repository can answer the question

Before changing code:

1. Inspect the relevant file.
2. Search for related implementations.
3. Search for existing utilities/components/hooks/repositories.
4. Check the API documentation in the repository when an API is involved.
5. Check package.json before introducing a dependency.
6. Understand how the existing feature is connected to navigation, API, state, and UI.

If the required information is not available, say what is missing instead of inventing an implementation.

---

## 1.2 Make the smallest possible change

Prefer:

- one function change over rewriting a file
- one component change over restructuring a screen
- reusing an existing utility over creating a duplicate utility
- modifying an existing repository over creating a second API implementation

Do NOT rewrite entire files merely because you can.

Do NOT reformat unrelated code.

Do NOT rename unrelated variables.

Do NOT move files unless the requested task requires it.

Do NOT perform unrelated cleanup.

### Important rule

> If the requested change can be completed by changing 10 lines, do not change 300 lines.

---

## 1.3 Do not break existing functionality

Every requested change must preserve unrelated functionality.

Before editing, identify:

- what the screen currently does
- what API it calls
- what navigation route it uses
- what data it expects
- what permissions it requests
- what role restrictions exist
- what shared components it uses

After editing, verify that those behaviors still exist.

---

# 2. PROJECT VERSION LOCK

The current project uses:

```
Expo: 57.0.24
React Native: 0.86.3
React: 19.2.3
React DOM: 19.2.3
Expo Router: ~57.0.22
Node/npm project managed through package.json + package-lock.json
```

## NEVER change these versions automatically

Do NOT:

- upgrade Expo
- downgrade Expo
- upgrade React Native
- downgrade React Native
- upgrade React
- downgrade React
- replace Expo Router
- regenerate package-lock.json unnecessarily
- install a different version because documentation for another Expo version was found

unless the user explicitly asks for a version migration.

### Critical

The old repository AGENTS.md referred to Expo SDK 54.

That instruction is obsolete.

**Use the actual installed project version: Expo SDK 57.**

When documentation is needed, use documentation compatible with the installed Expo SDK 57 version.

---

# 3. BEFORE EVERY TASK

For every task, follow this workflow.

## Phase A — Understand

First determine:

1. What does the user actually want?
2. Which screen/feature is involved?
3. Which files implement it?
4. Which shared utilities are involved?
5. Which API endpoint is involved?
6. Does an existing implementation already solve part of the problem?

## Phase B — Search

Search the repository for:

- relevant function names
- component names
- API endpoints
- imports
- existing utilities
- duplicate implementations
- existing error handling
- related screens

Do not assume the first matching file is the only implementation.

## Phase C — Plan

Before modifying a non-trivial feature, produce a short plan:

```
Root cause:
...

Files to change:
1. ...
2. ...

Files intentionally not changed:
...

Implementation:
...
```

For very small changes, planning can be internal, but the same discipline still applies.

## Phase D — Implement

Make the minimum change required.

## Phase E — Verify

After editing:

1. Inspect the final diff.
2. Check imports.
3. Check undefined variables/functions.
4. Check syntax.
5. Check affected API calls.
6. Check navigation routes if navigation is affected.
7. Check role guards if access control is affected.
8. Run the most relevant available validation command.
9. Do not claim success without verification.

---

# 4. USER INSTRUCTION PRIORITY

The user's explicit request is the source of truth for the requested behavior.

However, interpret requests precisely.

If the user says:

> "Only change the image compression"

then:

- do not change the API
- do not change the UI
- do not change navigation
- do not change authentication
- do not refactor unrelated code

If the user's request conflicts with existing architecture, explain the conflict before making a destructive change.

---

# 5. ASK INSTEAD OF GUESSING

Stop and ask for clarification when:

- two existing implementations conflict
- the requested behavior has multiple materially different interpretations
- an API contract is unclear
- a destructive migration is required
- a dependency change is required but not requested
- changing the requested behavior would break another feature
- the required backend behavior is not documented
- a security-sensitive behavior is ambiguous

Do NOT silently choose a random interpretation.

---

# 6. PROJECT ARCHITECTURE

The project uses an Expo Router `app/` directory for routes and a feature-oriented `src/` architecture.

The major structure is:

```
app/
  Expo Router route files

src/
  api/
  core/
  features/
    appointments/
    attendance/
    auth/
    clients/
    employees/
    health/
    home/
    masterData/
    notifications/
    payments/
    quotations/
    salary/
    schedules/
    search/
    settings/
    warranty/
  shared/
```

## Architecture principle

Routes in `app/` should generally connect Expo Router routes to feature screens.

Business logic should generally remain in the feature layer rather than being duplicated inside route files.

Use:

```
app route
   ↓
feature screen
   ↓
feature hook
   ↓
feature repository/API
   ↓
core API client
   ↓
backend
```

when that pattern already exists for the feature.

---

# 7. DO NOT CREATE DUPLICATE ARCHITECTURE

Before creating a new:

- API client
- repository
- hook
- utility
- modal
- skeleton
- navigation component
- image utility
- validation function

search for an existing one.

Examples of existing shared infrastructure include:

```
src/core/api/apiClient.js
src/core/utils/imageUtils.js
src/core/utils/validation.js
src/core/context/TabBarContext.jsx
src/shared/components/
src/shared/components/material/
```

Reuse existing infrastructure where appropriate.

---

# 8. API RULES

The canonical API configuration is:

```
src/core/config/config.js
```

The current canonical API base is API v2.

Do NOT hard-code API URLs into individual screens unless there is a specific documented reason.

Use:

```
src/core/config/config.js
```

and the existing repository/API architecture.

## API layer

The main Axios implementation is:

```
src/core/api/apiClient.js
```

The compatibility facade is:

```
src/api/apiClient.js
```

Do not create another global Axios client.

Do not bypass the existing API client without a concrete technical reason.

---

# 9. AUTHENTICATION RULES

Authentication uses AsyncStorage.

The existing API client automatically reads:

```
auth_token
```

and attaches:

```
Authorization: Bearer <token>
```

Do not create a second authentication mechanism.

Do not move authentication tokens to another storage mechanism unless explicitly requested.

Be careful when changing:

- login
- logout
- session expiration
- 401 handling
- auth repository
- protected routes

because these are cross-cutting features.

---

# 10. MULTIPART / FILE UPLOAD RULES

This project has custom multipart handling in:

```
src/core/api/apiClient.js
```

The project uses XMLHttpRequest for multipart FormData requests because the existing implementation intentionally bypasses Expo fetch/FormData serialization limitations.

Therefore:

## DO NOT casually replace multipart handling with standard Axios fetch behavior.

Before modifying uploads, inspect:

```
src/core/api/apiClient.js
src/features/employees/api/employeeRepository.js
src/features/payments/api/paymentRepository.js
```

and the affected screen.

---

# 11. IMAGE UPLOAD AND COMPRESSION

The project already has:

```
src/core/utils/imageUtils.js
```

with:

```
compressImage()
formatFileSize()
resolveProofImageUrl()
getProofFilename()
```

There is already image compression infrastructure.

Before creating another image compressor:

1. Inspect `imageUtils.js`.
2. Search all uses of `compressImage`.
3. Determine whether the requested screen already uses it.
4. Reuse or improve the existing utility rather than creating a duplicate.

Current image-related packages include:

```
expo-image
expo-image-manipulator
expo-image-picker
expo-file-system
```

When the user asks for image compression:

- compress before upload
- preserve the original image when it is already below the target where appropriate
- preserve file extension/type requirements expected by the backend
- verify the resulting file exists
- verify multipart upload still works
- do not accidentally compress PDFs
- do not modify unrelated image display behavior

### Important

A compression quality value is NOT the same thing as an exact file-size guarantee.

If the user asks for:

> "5 MB → 250 KB"

implement target-size behavior carefully rather than assuming:

```
compress: 0.5
```

means 250 KB.

If an exact maximum is required, verify the resulting file size before upload.

---

# 12. FILE TYPE SAFETY

Some project flows accept both images and PDFs.

Never apply image compression blindly to all uploaded files.

Before compression, determine:

```
Is this an image?
Is this a PDF?
What MIME type is expected?
What filename is expected?
What does the backend accept?
```

For payment/proof uploads especially, inspect the existing repository implementation before changing the upload payload.

---

# 13. API DOCUMENTATION

The repository contains API documentation:

```
CONNECT_FRONTEND_BACKEND_V2 (1).md
```

and architecture documentation:

```
SHARED_ADMIN_EMPLOYEE_ARCHITECTURE.md
```

When changing backend-connected functionality:

1. Read the relevant section of the API documentation.
2. Follow the documented endpoint and payload shape.
3. Do not invent endpoint names.
4. Do not invent field names.
5. Do not change API versions casually.

If the implementation and documentation disagree, report the discrepancy.

Do not silently "fix" one based on assumptions.

---

# 14. FEATURE-SPECIFIC API STRUCTURE

The project already organizes API calls by feature.

Examples:

```
src/features/appointments/api/
src/features/auth/api/
src/features/clients/api/
src/features/employees/api/
src/features/payments/api/
src/features/quotations/api/
src/features/settings/api/
src/features/warranty/api/
```

Prefer feature repositories for API operations.

Do not put feature-specific API calls directly into unrelated shared utilities.

---

# 15. NAVIGATION RULES

This project uses Expo Router.

Route files are under:

```
app/
```

and feature screens are under:

```
src/features/*/screens/
```

When changing navigation:

1. Inspect `app/_layout.jsx`.
2. Inspect the relevant route.
3. Inspect the feature screen.
4. Check existing navigation patterns.
5. Check route guards.
6. Check role restrictions.

Do not create duplicate routes.

Do not rename routes casually because route names may be referenced elsewhere.

---

# 16. ROLE-BASED ACCESS

The application supports Admin and Field Employee behavior through a shared architecture.

Important shared components include:

```
src/shared/components/RoleGuard.jsx
src/shared/components/PersistentNavigation.jsx
```

When changing access to a screen/action:

- check the existing role guard
- check navigation visibility
- check server-side authorization expectations
- do not rely only on hiding a button for security

UI visibility is not a substitute for backend authorization.

---

# 17. UI PRESERVATION RULE

Unless the user explicitly asks for a UI redesign:

DO NOT:

- change colors
- change spacing
- change typography
- change component sizes
- change navigation appearance
- replace existing components
- redesign forms
- change animations
- change dark/light theme behavior

A bug fix should remain visually consistent with the current application.

---

# 18. STYLING RULES

Use the existing styling patterns in the affected screen.

Do not introduce a new styling system.

Before adding styles:

1. Inspect nearby styles.
2. Reuse existing constants/theme values where appropriate.
3. Preserve dark mode.
4. Preserve responsive behavior.
5. Avoid magic values if an existing theme constant exists.

---

# 19. COMPONENT REUSE

Before creating a component, search:

```
src/shared/components/
src/shared/components/material/
src/features/*/components/
```

There are already reusable components such as:

```
InnerHeader
PersistentNavigation
RoleGuard
TitleDropdown
MaterialAlertModal
MaterialCardSkeleton
MaterialDeleteModal
MaterialDetailSkeleton
MaterialFormSkeleton
MaterialListSkeleton
MaterialOverlayLoader
MaterialPageLoader
MaterialProgressBar
MaterialSkeleton
MaterialSuccessModal
```

Do not create a duplicate component with a slightly different name.

---

# 20. ERROR HANDLING

Use the project's existing API error/session handling.

The API client already contains:

- authentication handling
- session expiration handling
- server error handling
- retry-related infrastructure
- multipart handling

Do not add random `alert()` / `console.error()` handling everywhere if the existing infrastructure already provides the appropriate behavior.

For user-facing errors:

- give a useful message
- do not expose raw backend internals unnecessarily
- preserve existing error UI patterns

---

# 21. LOGGING

Do not flood production code with debug logs.

Temporary debugging is acceptable while investigating a problem, but:

1. Keep logs focused.
2. Do not log passwords.
3. Do not log authentication tokens.
4. Do not log sensitive customer/payment information.
5. Remove unnecessary debug logs after the fix.

---

# 22. DATA AND BUSINESS LOGIC

This application contains business-critical flows including:

- appointments
- quotations
- payments
- payment verification
- receipts
- warranties
- employee management
- attendance
- salary
- customer management

Do not change calculations or business rules without inspecting the existing implementation and relevant documentation.

For payment/quotation changes, be especially conservative.

Never "simplify" financial calculations without proving that the resulting behavior is equivalent.

---

# 23. FORMS AND VALIDATION

Before adding validation:

1. Search `src/core/utils/validation.js`.
2. Search the affected feature for existing validation.
3. Check the backend/API documentation.
4. Preserve existing validation messages unless the user asks to change them.

Do not add arbitrary restrictions to inputs.

If the user requests a specific restriction, implement exactly that restriction and avoid changing other fields.

---

# 24. DEPENDENCY RULES

Do not install a package automatically just because it seems convenient.

Before adding a package:

1. Search package.json.
2. Search the codebase for an existing solution.
3. Check whether Expo already provides the required capability.
4. Explain why a new dependency is required.
5. Only install it if the user has requested implementation and the dependency is genuinely necessary.

Never casually change:

```
expo
react
react-native
expo-router
react-native-reanimated
react-native-worklets
```

versions.

---

# 25. PACKAGE-LOCK RULE

The repository contains:

```
package-lock.json
```

Do not manually rewrite it.

When a legitimate dependency change is explicitly approved, use npm so the lockfile is generated consistently.

Do not change package-lock.json just to make an unrelated task look clean.

---

# 26. EAS / BUILD RULES

The project contains:

```
eas.json
app.json
```

and has an EAS project ID.

Do not change:

- bundle identifier
- Android package
- iOS bundle identifier
- EAS project ID
- build profiles
- Expo plugins

unless the user explicitly asks for a build/configuration change.

Current identifiers include:

```
iOS:
nexacrm.in.drterrace

Android:
nexacrm.in.drterrace
```

Treat these as production identifiers.

---

# 27. APP CONFIGURATION

The main Expo configuration is:

```
app.json
```

It includes:

- Expo Router
- splash configuration
- build properties
- Expo Image
- Expo Sharing
- Expo Web Browser
- typed routes
- React Compiler
- new architecture

Do not remove plugins or experiments because they appear unused without verifying their purpose.

---

# 28. ENVIRONMENT / API URL

API configuration is in:

```
src/core/config/config.js
```

The app supports:

```
EXPO_PUBLIC_API_URL
```

Do not hard-code a development server URL into feature code.

Do not replace the production API URL with localhost just to make local testing work.

If local development requires a different API URL, use the existing environment configuration approach.

---

# 29. TESTING AND VERIFICATION

Available npm scripts include:

```
npm run lint
npm run test:health
npm run test:login
npm run test:v2
```

Use the most relevant checks for the change.

For a UI-only change:

```
npm run lint
```

For API changes, use the relevant health/login/v2 checks where appropriate.

For image/file upload changes:

- lint
- inspect the FormData payload
- verify file URI/type/size
- verify the relevant upload path
- test the affected screen when possible

---

# 30. DO NOT CLAIM TESTING YOU DID NOT PERFORM

Never say:

> "Everything works."

unless you actually verified it.

Instead say:

```
Implemented the change.

Verified:
- npm run lint
- relevant code path inspected

Not verified:
- physical device upload
- production API response
```

Be honest about verification.

---

# 31. GIT / DIFF SAFETY

Before finishing a task, inspect the diff.

The final change should contain only files necessary for the user's request.

If unrelated files changed accidentally:

- revert those unrelated changes if they were introduced by you
- do not overwrite user work
- do not reset the repository blindly

Never run destructive Git commands such as:

```
git reset --hard
git clean -fd
```

unless the user explicitly requests it and the consequences are clearly understood.

---

# 32. NEVER DESTROY USER WORK

Do not overwrite existing user modifications simply because they conflict with your preferred implementation.

Before changing a heavily modified file:

- inspect the current contents
- preserve existing logic
- modify only the required section

If you find unexpected changes that appear to belong to the user, preserve them.

---

# 33. NO UNREQUESTED REFACTORING

Do not combine a bug fix with:

- architecture migration
- TypeScript migration
- folder restructuring
- dependency upgrades
- UI redesign
- API redesign
- state management migration
- navigation migration

unless explicitly requested.

A small task should remain a small task.

---

# 34. WHEN THE USER SAYS "FIX THIS"

"Fix this" means:

1. Reproduce/understand the problem.
2. Find the root cause.
3. Make the smallest correct fix.
4. Verify it.

It does NOT mean:

- rewrite the whole feature
- upgrade dependencies
- redesign the screen
- refactor unrelated code

---

# 35. WHEN THE USER SAYS "MAKE IT BETTER"

"Better" is ambiguous.

Do not automatically redesign the feature.

First determine whether "better" means:

- faster
- smaller
- more reliable
- easier to use
- visually different
- fewer errors
- lower memory usage
- lower network usage

If the intended meaning is unclear and the change could be significant, ask.

---

# 36. PERFORMANCE RULES

For performance changes:

1. Measure/inspect before optimizing.
2. Identify the actual bottleneck.
3. Avoid premature optimization.
4. Do not sacrifice correctness for small theoretical gains.

For images specifically:

- reduce dimensions when appropriate
- compress before upload
- avoid repeatedly decoding/re-encoding the same image
- avoid unnecessary image copies
- verify resulting file size
- avoid loading huge images into memory unnecessarily

---

# 37. MEMORY / MOBILE DEVICE SAFETY

This is a React Native mobile application.

Avoid unnecessarily creating:

- huge base64 strings
- duplicate image buffers
- large in-memory arrays
- repeated full-screen component trees
- repeated network requests

Prefer file URIs for image uploads instead of converting large images to base64 unless the API explicitly requires base64.

---

# 38. ASYNC CODE

For asynchronous code:

- use `async/await` consistently with surrounding code
- handle failures
- avoid unhandled promises
- do not introduce race conditions
- clean up listeners/subscriptions where applicable

When modifying effects, inspect:

```
useEffect
useFocusEffect
navigation listeners
AsyncStorage calls
API requests
```

for lifecycle problems.

---

# 39. IMAGE PICKER RULES

The project uses Expo Image Picker.

Before modifying image selection:

Search for existing patterns such as:

```
launchCameraAsync
launchImageLibraryAsync
requestCameraPermissionsAsync
requestMediaLibraryPermissionsAsync
compressImage
```

Do not create a new image-selection abstraction unless the user actually needs one.

Preserve:

- camera permissions
- gallery permissions
- editing/cropping behavior
- aspect ratios
- quality settings
- cancel behavior

unless the user asks to change them.

---

# 40. PDF RULE

The project uses PDF-related functionality.

Never treat PDFs as images.

Before changing file handling, check:

```
mimeType
fileName
URI
extension
upload field name
```

If a flow supports both images and PDFs, branch explicitly.

---

# 41. API PAYLOAD SAFETY

When modifying a request:

Do not rename fields without checking:

- repository implementation
- screen payload
- API documentation
- backend contract if available

For example, do not change:

```
proofImage
proof
image
file
receipt
```

interchangeably without verifying the actual API contract.

---

# 42. RESPONSE SAFETY

Do not assume API responses always have the same shape.

First inspect how the existing repository handles the response.

Preserve established response normalization.

Do not silently change:

```
response.data
response.data.data
response.data.user
response.data.items
```

unless the API contract confirms the change.

---

# 43. NAVIGATION PARAMETER SAFETY

Before changing route parameters:

Search for:

```
router.push
router.replace
router.back
useLocalSearchParams
```

and all references to the route.

Do not rename a parameter in one screen without updating every consumer.

---

# 44. ROLE / PERMISSION SAFETY

Never rely only on UI hiding for authorization.

If a user asks to hide an Admin action:

- update UI visibility
- preserve backend authorization
- preserve route protection where applicable

Do not weaken access controls.

---

# 45. OUTPUT FORMAT AFTER COMPLETING A TASK

At the end of a task, report:

```
Implemented:
- ...

Files changed:
- ...

Why:
- ...

Verification:
- ...

Potential limitations:
- ...
```

Keep it concise.

If no tests were run, say so.

---

# 46. SPECIAL RULE FOR LARGE TASKS

For tasks involving multiple features or many files:

Do NOT immediately modify everything.

Break the work into stages:

```
Stage 1 — Inspect
Stage 2 — Plan
Stage 3 — Core implementation
Stage 4 — Integration
Stage 5 — Verification
```

After each stage, ensure the previous stage is correct before continuing.

---

# 47. SPECIAL RULE FOR BUG FIXES

For a bug:

```
SYMPTOM
↓
REPRODUCE
↓
TRACE
↓
ROOT CAUSE
↓
MINIMAL FIX
↓
VERIFY
```

Do not patch symptoms blindly.

Example:

If an upload fails, do not immediately change Axios.

First inspect:

```
picker result
↓
URI
↓
file size
↓
MIME type
↓
compression
↓
FormData
↓
API client multipart adapter
↓
server response
```

Find the actual failure point.

---

# 48. SPECIAL RULE FOR USER'S EXACT REQUEST

If the user gives a concrete requirement such as:

> "Limit this input to two digits."

Implement exactly that.

Do not additionally:

- redesign the input
- change validation across the application
- change the backend
- change the database
- add a package
- refactor the entire form

unless the requirement requires it.

---

# 49. DO NOT INVENT FEATURES

Do not invent:

- API endpoints
- response fields
- database fields
- navigation routes
- roles
- permissions
- package APIs
- Expo APIs
- backend behavior

If uncertain, inspect the project or ask.

---

# 50. FINAL CHECKLIST

Before saying a task is complete, verify:

### Scope

- \[ \] Only requested functionality was changed.
- \[ \] No unrelated refactor was introduced.
- \[ \] Existing behavior was preserved.

### Code

- \[ \] Imports are correct.
- \[ \] No undefined variables.
- \[ \] No duplicate utilities/components.
- \[ \] Existing architecture was followed.

### Expo

- \[ \] Expo SDK 57 compatibility preserved.
- \[ \] No accidental package upgrades.
- \[ \] No accidental Expo config changes.

### API

- \[ \] Correct repository/API client used.
- \[ \] Correct endpoint used.
- \[ \] Correct request fields used.
- \[ \] Auth behavior preserved.
- \[ \] Multipart behavior preserved where relevant.

### Images/files

- \[ \] File type checked.
- \[ \] Image compression only applied to images.
- \[ \] PDFs preserved.
- \[ \] File URI and MIME type remain valid.
- \[ \] Resulting file size checked when a target size is required.

### UI

- \[ \] Existing UI preserved unless requested.
- \[ \] Dark/light behavior preserved.
- \[ \] Navigation preserved.
- \[ \] Existing reusable components reused.

### Verification

- \[ \] Relevant lint/test/check was run.
- \[ \] Final diff was reviewed.
- \[ \] No false claims about testing were made.

---

# 51. GOLDEN RULE

## THINK FIRST. SEARCH SECOND. CHANGE MINIMALLY. VERIFY LAST.

The most important instruction in this file is:

> **Never make a large change to solve a small request.**

When in doubt:

1. Inspect.
2. Search.
3. Understand.
4. Ask if necessary.
5. Make the smallest correct change.
6. Verify.
