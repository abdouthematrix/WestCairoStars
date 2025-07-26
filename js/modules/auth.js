//==========================Authentication Module==================================//

const AuthModule = {
    // Login Handler
    async handleLogin(event) {
        event.preventDefault();
        const username = document.getElementById('userName').value.trim();
        const userpassword = document.getElementById('userPassword').value.trim();

        if (!username || !userpassword) {
            alert("Username and password required");
            return;
        }

        const email = username + '@westcairo.com';
        const { db, auth } = window.appUtils;
        const currentLanguage = window.appUtils.currentLanguage();

        try {
            window.appUtils.showLoadingIndicator();

            const userCredential = await firebase.auth().signInWithEmailAndPassword(email, userpassword);
            const teamDoc = await db.collection('teams').doc(userCredential.user.uid).get();

            if (teamDoc.exists) {
                window.appUtils.setCurrentTeamCode(userCredential.user.uid);

                if (teamDoc.data().isAdmin) {
                    await showAdmin();
                } else {
                    await showDashboard();
                    // Wait for dashboard to load, then set team name and load members
                    setTimeout(() => {
                        const teamNameElem = document.getElementById('teamName');
                        if (teamNameElem) {
                            teamNameElem.textContent = teamDoc.data().name || teamCode;
                        }
                    }, 100);
                }
            } else {
                alert(currentLanguage === 'ar' ? 'رمز الفريق غير صحيح' : 'Invalid team code');
            }
        } catch (error) {
            console.error('Login error:', error);
            alert(currentLanguage === 'ar' ? 'خطأ في تسجيل الدخول' : 'Login error');
        } finally {
            window.appUtils.hideLoadingIndicator();
        }
    },

    // Logout
    async logout() {
        try {
            await firebase.auth().signOut();
            console.log("Logged out successfully");
            window.appUtils.setCurrentTeamCode(null);
            await showLeaderboard();
        } catch (error) {
            console.error("Logout error:", error);
            alert("Logout failed");
        }
    },

    // Check authentication state
    onAuthStateChanged(callback) {
        return firebase.auth().onAuthStateChanged(callback);
    },

    // Get current user
    getCurrentUser() {
        return firebase.auth().currentUser;
    }
};

// Register module globally
window.modules = window.modules || {};
window.modules.auth = AuthModule;

// Make functions globally accessible for HTML onclick handlers
window.handleLogin = AuthModule.handleLogin;
window.logout = AuthModule.logout;

export default AuthModule;