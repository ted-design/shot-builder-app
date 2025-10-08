// Run this in browser console while signed in to check your claims
console.log('🔍 Checking Firebase Auth Claims...\n');

if (window.firebase && firebase.auth().currentUser) {
  firebase.auth().currentUser.getIdTokenResult(true).then(idTokenResult => {
    console.log('✅ User Info:');
    console.log('   Email:', firebase.auth().currentUser.email);
    console.log('   UID:', firebase.auth().currentUser.uid);
    console.log('\n📋 Custom Claims:');
    console.log(JSON.stringify(idTokenResult.claims, null, 2));
    console.log('\n🎯 Expected Claims:');
    console.log('   role: "admin"');
    console.log('   clientId: "unbound-merino"');
    console.log('\n✅ Claims Check:');
    console.log('   Has role claim:', idTokenResult.claims.role === 'admin' ? '✅ YES' : '❌ NO');
    console.log('   Has clientId claim:', idTokenResult.claims.clientId === 'unbound-merino' ? '✅ YES' : '❌ NO');
  });
} else {
  console.log('❌ Not signed in or Firebase not loaded');
  console.log('Please sign in to the app first, then run this script again');
}
