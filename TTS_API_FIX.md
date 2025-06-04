# Google Text-to-Speech API Authentication Fix

## Issue
The application was experiencing an authentication error with the Google Text-to-Speech API:

```
TTS API error (500): {"error":"16 UNAUTHENTICATED: Request had invalid authentication credentials. Expected OAuth 2 access token, login cookie or other valid authentication credential. See https://developers.google.com/identity/sign-in/web/devconsole-project.", "success":false, "details":"16 UNAUTHENTICATED: Request had invalid authentication credentials. Expected OAuth 2 access token, login cookie or other valid authentication credential. See https://developers.google.com/identity/sign-in/web/devconsole-project." }
```

## Root Cause
The issue was caused by invalid or corrupted service account credentials in the original `credentials/google-credentials.json` file. The JWT signature was invalid, preventing proper authentication with Google Cloud services.

## Solution
1. Created a new service account key file using the gcloud CLI:
   ```
   gcloud iam service-accounts keys create new-google-credentials.json --iam-account=glyssa@winter-dynamics-458105-j7.iam.gserviceaccount.com
   ```

2. Added the necessary IAM role to the service account:
   ```
   gcloud projects add-iam-policy-binding winter-dynamics-458105-j7 --member=serviceAccount:glyssa@winter-dynamics-458105-j7.iam.gserviceaccount.com --role=roles/serviceusage.serviceUsageConsumer
   ```

3. Updated the application to use the new credentials file by modifying `src/app/api/tts/route.ts`.

## Verification
The fix was verified by:
1. Successfully authenticating with the new credentials file
2. Successfully listing available voices from the Text-to-Speech API
3. Successfully synthesizing speech using the Text-to-Speech API

## Future Maintenance
If you encounter similar authentication issues in the future:

1. Check if the service account key file is valid and not corrupted
2. Verify that the service account has the necessary permissions
3. Create a new service account key if needed
4. Update the application to use the new credentials file

Service account keys can expire or be revoked, so it's important to have a process for rotating them regularly.