// Paste this in your browser console when logged in:
firebase.auth().currentUser.getIdTokenResult().then(idTokenResult => {
  console.log('Auth Token Claims:', {
    uid: firebase.auth().currentUser.uid,
    email: firebase.auth().currentUser.email,
    claims: idTokenResult.claims
  });
});
