https://abdouthematrix.github.io/WestCairoRegion/

# West Cairo Region App

## Admin Workflow

### Features
- Admins can view all teams and their members from the Admin Dashboard.
- For each member, admins can edit and save a new field: `reviewedScores` (per product).
- Changes are saved to Firestore under each member's document.

### How to Use (Admin)
1. Log in with a team code that has admin privileges.
2. Go to the Admin Dashboard.
3. All teams and their members are displayed in tables.
4. For each member, edit the reviewed scores and click "Save" to update Firestore.

### Firestore Security Rules (Recommended)
Only admins should be able to write to teams and teamMembers collections. Use Firebase Auth custom claims for admin status.

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /teams/{teamId} {
      allow read: if true;
      allow write: if request.auth != null && request.auth.token.admin == true;
    }
    match /teamMembers/{memberId} {
      allow read: if true;
      allow write: if request.auth != null && request.auth.token.admin == true;
    }
  }
}
```

### Setting Admin Custom Claims
Set admin status for a user using the Firebase Admin SDK:
```js
admin.auth().setCustomUserClaims(uid, { admin: true });
```
Replace `uid` with the Firebase Auth UID of the admin user.

---

For questions or further customization, see the code comments or contact the developer.
