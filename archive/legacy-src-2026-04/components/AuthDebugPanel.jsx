import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { auth } from '../lib/firebase';

export function AuthDebugPanel() {
  const authContext = useAuth();
  const [tokenClaims, setTokenClaims] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadClaims() {
      if (auth.currentUser) {
        try {
          const tokenResult = await auth.currentUser.getIdTokenResult(true);
          setTokenClaims(tokenResult.claims);
        } catch (err) {
          console.error('Failed to get token claims:', err);
        }
      }
      setLoading(false);
    }
    loadClaims();
  }, []);

  const handleRefreshToken = async () => {
    setLoading(true);
    try {
      console.log('🔄 Forcing complete Firestore reset...');

      // Dynamic import to avoid circular deps
      const { resetFirestoreConnection } = await import('../lib/firestore-reset');
      await resetFirestoreConnection();

    } catch (err) {
      console.error('❌ Reset failed:', err);
      alert('Failed to reset: ' + err.message);
      setLoading(false);
    }
  };

  if (loading) return <div className="p-4">Loading auth debug info...</div>;

  if (!auth.currentUser) {
    return <div className="p-4 bg-red-100 text-red-800 rounded">Not signed in</div>;
  }

  const hasRole = tokenClaims?.role === 'admin';
  const hasClientId = tokenClaims?.clientId === 'unbound-merino';
  const allGood = hasRole && hasClientId;

  return (
    <div className="fixed bottom-4 right-4 bg-white border-2 border-slate-300 rounded-card shadow-lg p-4 max-w-md z-50">
      <h3 className="font-bold text-lg mb-2">🔍 Auth Debug Panel</h3>

      <div className="mb-2">
        <strong>Email:</strong> {auth.currentUser.email}
      </div>

      <div className="mb-2">
        <strong>UID:</strong> <code className="text-xs">{auth.currentUser.uid}</code>
      </div>

      <div className="mb-2">
        <strong>Auth Context:</strong>
        <div className="text-xs">
          <div>• Initializing: {authContext.initializing ? '⏳' : '✅'}</div>
          <div>• Loading Claims: {authContext.loadingClaims ? '⏳' : '✅'}</div>
          <div>• Ready: {authContext.ready ? '✅' : '❌'}</div>
          <div>• Role from context: {authContext.role || '(none)'}</div>
          <div>• ClientId from context: {authContext.clientId || '(none)'}</div>
        </div>
      </div>

      <div className={`mb-2 p-2 rounded ${allGood ? 'bg-green-100' : 'bg-red-100'}`}>
        <strong>Token Claims:</strong>
        <div className="text-xs mt-1">
          <div className="flex items-center gap-2">
            <span>{hasRole ? '✅' : '❌'}</span>
            <span>role: {tokenClaims?.role || '(missing)'}</span>
          </div>
          <div className="flex items-center gap-2">
            <span>{hasClientId ? '✅' : '❌'}</span>
            <span>clientId: {tokenClaims?.clientId || '(missing)'}</span>
          </div>
        </div>
      </div>

      {!allGood && (
        <div className="mb-2 p-2 bg-yellow-100 text-yellow-800 text-sm rounded">
          ⚠️ Custom claims are missing! You need to sign out and back in after running the setup script.
        </div>
      )}

      <div className="mb-2">
        <strong>All Token Claims:</strong>
        <pre className="text-xs bg-slate-100 p-2 rounded mt-1 overflow-auto max-h-40">
          {JSON.stringify(tokenClaims, null, 2)}
        </pre>
      </div>

      <button
        onClick={handleRefreshToken}
        className="w-full bg-blue-500 text-white px-3 py-2 rounded hover:bg-blue-600 text-sm"
      >
        Force Refresh Token
      </button>
    </div>
  );
}
