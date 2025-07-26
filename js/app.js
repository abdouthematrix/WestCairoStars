//==========================Main App Module==================================//

// Firebase Configuration
const firebaseConfig = {
    apiKey: "AIzaSyD3WUdT177BGJWjJrrNRsDif7fQTm_GqZ4",
    authDomain: "westcairoregion.firebaseapp.com",
    projectId: "westcairoregion",
    storageBucket: "westcairoregion.firebasestorage.app",
    messagingSenderId: "946920356743",
    appId: "1:946920356743:web:71f8bea2b3d261a7b9f122"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();
const auth = firebase.auth();

// Global Variables
let currentLanguage = 'ar';
let currentTeamCode = null;
let teamMembers = [];

// Products configuration
const products = [
    'securedLoan',
    'securedCreditCard',
    'unsecuredLoan',
    'unsecuredCreditCard',
    'bancassurance'
];

// Module loader with caching
class ModuleLoader {
    constructor() {
        this.loadedModules = new Map();
        this.loadingPromises = new Map();
    }

    async loadModule(moduleName) {
        // Return cached module if already loaded
        if (this.loadedModules.has(moduleName)) {
            return this.loadedModules.get(moduleName);
        }

        // Return existing loading promise if module is being loaded
        if (this.loadingPromises.has(moduleName)) {
            return this.loadingPromises.get(moduleName);
        }

        // Create loading promise
        const loadingPromise = this.createLoadingPromise(moduleName);
        this.loadingPromises.set(moduleName, loadingPromise);

        try {
            const module = await loadingPromise;
            this.loadedModules.set(moduleName, module);
            this.loadingPromises.delete(moduleName);
            return module;
        } catch (error) {
            this.loadingPromises.delete(moduleName);
            throw error;
        }
    }

    async createLoadingPromise(moduleName) {
        const script = document.createElement('script');
        script.src = `js/modules/${moduleName}.js`;
        script.type = 'module';

        return new Promise((resolve, reject) => {
            script.onload = () => {
                // Module should register itself in window.modules
                if (window.modules && window.modules[moduleName]) {
                    resolve(window.modules[moduleName]);
                } else {
                    reject(new Error(`Module ${moduleName} not found`));
                }
            };
            script.onerror = () => reject(new Error(`Failed to load module ${moduleName}`));
            document.head.appendChild(script);
        });
    }
}

// Global module loader instance
window.moduleLoader = new ModuleLoader();

// Module registry for loaded modules
window.modules = {};

// Language Toggle
function toggleLanguage() {
    currentLanguage = currentLanguage === 'ar' ? 'en' : 'ar';
    const isRTL = currentLanguage === 'ar';
    document.documentElement.setAttribute('lang', currentLanguage);
    document.documentElement.setAttribute('dir', isRTL ? 'rtl' : 'ltr');

    // Update all translatable elements
    document.querySelectorAll('[data-en][data-ar]').forEach(element => {
        element.textContent = element.getAttribute(`data-${currentLanguage}`);
    });

    // Update language toggle button
    const langToggleBtn = document.querySelector('.language-toggle');
    if (langToggleBtn) {
        langToggleBtn.textContent = currentLanguage === 'ar' ? 'EN' : 'ع';
    }
}

// Dynamic Page Loader with lazy loading
async function loadPage(page) {
    try {
        // Show loading indicator
        showLoadingIndicator();

        // Load page HTML
        const response = await fetch(`Pages/${page}.html`);
        const html = await response.text();
        document.getElementById('app').innerHTML = html;

        // Re-initialize language
        toggleLanguage();
        toggleLanguage();

        // Lazy load required modules based on page
        await loadPageModules(page);

        // Hide loading indicator
        hideLoadingIndicator();

    } catch (error) {
        console.error('Error loading page:', error);
        hideLoadingIndicator();
        showErrorMessage('Failed to load page');
    }
}

// Load modules required for specific pages
async function loadPageModules(page) {
    switch (page) {
        case 'leaderboard':
            const leaderboardModule = await window.moduleLoader.loadModule('leaderboard');
            await leaderboardModule.initializeLeaderboard();
            break;

        case 'dashboard':
            const dashboardModule = await window.moduleLoader.loadModule('dashboard');
            if (currentTeamCode) {
                await dashboardModule.loadTeamMembers(currentTeamCode, teamMembers);
            }
            break;

        case 'login':
            // Login module will be loaded when needed
            await window.moduleLoader.loadModule('auth');
            break;

        case 'admin':
            const adminModule = await window.moduleLoader.loadModule('admin');
            if (currentTeamCode) {
                await adminModule.loadAllTeamsForAdmin();
            }
            break;
    }
}

// Navigation functions
async function showLeaderboard() {
    await loadPage('leaderboard');
}

async function showDashboard() {
    await loadPage('dashboard');
}

async function showLogin() {
    await loadPage('login');
}

async function showAdmin() {
    await loadPage('admin');
}

// Loading indicator functions
function showLoadingIndicator() {
    const existingLoader = document.getElementById('global-loader');
    if (existingLoader) return;

    const loader = document.createElement('div');
    loader.id = 'global-loader';
    loader.innerHTML = `
        <div style="
            position: fixed;
            top: 0;
            left: 0;
            width: 100vw;
            height: 100vh;
            background: rgba(0,0,0,0.5);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 9999;
        ">
            <div style="
                background: white;
                padding: 20px;
                border-radius: 10px;
                text-align: center;
            ">
                <div class="spinner" style="
                    border: 4px solid #f3f3f3;
                    border-top: 4px solid #3498db;
                    border-radius: 50%;
                    width: 40px;
                    height: 40px;
                    animation: spin 1s linear infinite;
                    margin: 0 auto 10px;
                "></div>
                <p>${currentLanguage === 'ar' ? 'جاري التحميل...' : 'Loading...'}</p>
            </div>
        </div>
    `;

    // Add spinner animation if not exists
    if (!document.getElementById('spinner-style')) {
        const style = document.createElement('style');
        style.id = 'spinner-style';
        style.textContent = `
            @keyframes spin {
                0% { transform: rotate(0deg); }
                100% { transform: rotate(360deg); }
            }
        `;
        document.head.appendChild(style);
    }

    document.body.appendChild(loader);
}

function hideLoadingIndicator() {
    const loader = document.getElementById('global-loader');
    if (loader) {
        loader.remove();
    }
}

// Error message display
function showErrorMessage(message) {
    const app = document.getElementById('app');
    if (app) {
        app.innerHTML = `
            <div style="text-align: center; padding: 50px; color: var(--danger-color, #dc3545);">
                <h3>${currentLanguage === 'ar' ? 'خطأ' : 'Error'}</h3>
                <p>${message}</p>
                <button onclick="showLeaderboard()" style="
                    background: var(--primary-color, #007bff);
                    color: white;
                    border: none;
                    padding: 10px 20px;
                    border-radius: 5px;
                    cursor: pointer;
                    margin-top: 10px;
                ">
                    ${currentLanguage === 'ar' ? 'العودة للرئيسية' : 'Back to Home'}
                </button>
            </div>
        `;
    }
}

// Utility functions for modules
window.appUtils = {
    db,
    auth,
    currentLanguage: () => currentLanguage,
    currentTeamCode: () => currentTeamCode,
    setCurrentTeamCode: (code) => { currentTeamCode = code; },
    teamMembers: () => teamMembers,
    setTeamMembers: (members) => { teamMembers = members; },
    products,
    showLoadingIndicator,
    hideLoadingIndicator,
    showErrorMessage,
    toggleLanguage,
    // Add new helper function to get today's date in YYYY-MM-DD format
    getTodayString() {
        const today = new Date();
        return today.toISOString().split('T')[0];
    },   
    getYesterdayString() {
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        return yesterday.toISOString().split('T')[0];
    },
    // Caching system for daily scores
    _dailyScoresCache: new Map(),
    _cacheExpiry: 5 * 60 * 1000, // 5 minutes
    // Generate cache key
    _getCacheKey(memberId, teamCode, date) {
        return `${date}-${teamCode}-${memberId}`;
    },
    // Check if cache is valid
    _isCacheValid(cacheEntry) {
        return cacheEntry && (Date.now() - cacheEntry.timestamp < this._cacheExpiry);
    },

    // Clear cache for specific date/team
    clearScoresCache(date = null, teamCode = null) {
        if (!date && !teamCode) {
            this._dailyScoresCache.clear();
            return;
        }

        const keysToDelete = [];
        for (const key of this._dailyScoresCache.keys()) {
            if (date && teamCode && key.startsWith(`${date}-${teamCode}-`)) {
                keysToDelete.push(key);
            } else if (date && key.startsWith(`${date}-`)) {
                keysToDelete.push(key);
            }
        }
        keysToDelete.forEach(key => this._dailyScoresCache.delete(key));
    },

    // Batch load daily scores for multiple members
    async loadBatchDailyScores(memberIds, teamCode, date) {
        const { db } = window.appUtils;
        const results = {};
        const uncachedMemberIds = [];

        // Check cache first
        for (const memberId of memberIds) {
            const cacheKey = this._getCacheKey(memberId, teamCode, date);
            const cached = this._dailyScoresCache.get(cacheKey);

            if (this._isCacheValid(cached)) {
                results[memberId] = cached.data;
            } else {
                uncachedMemberIds.push(memberId);
            }
        }

        // Load uncached data in batch
        if (uncachedMemberIds.length > 0) {
            try {
                const collectionRef = db.collection('scores').doc(date).collection(teamCode);

                // Firestore 'in' queries are limited to 10 items, so we might need to batch
                const batches = [];
                for (let i = 0; i < uncachedMemberIds.length; i += 10) {
                    batches.push(uncachedMemberIds.slice(i, i + 10));
                }

                for (const batch of batches) {
                    const snapshot = await collectionRef.where('__name__', 'in', batch).get();

                    // Process results and update cache
                    snapshot.forEach(doc => {
                        const data = doc.data();
                        const result = {
                            scores: data?.scores || {},
                            reviewedScores: data?.reviewedScores || {}
                        };

                        results[doc.id] = result;

                        // Cache the result
                        const cacheKey = this._getCacheKey(doc.id, teamCode, date);
                        this._dailyScoresCache.set(cacheKey, {
                            data: result,
                            timestamp: Date.now()
                        });
                    });

                    // Add empty results for members with no data
                    batch.forEach(memberId => {
                        if (!results[memberId]) {
                            const emptyResult = {
                                scores: {},
                                reviewedScores: {}
                            };
                            results[memberId] = emptyResult;

                            const cacheKey = this._getCacheKey(memberId, teamCode, date);
                            this._dailyScoresCache.set(cacheKey, {
                                data: emptyResult,
                                timestamp: Date.now()
                            });
                        }
                    });
                }
            } catch (error) {
                console.error('Error in batch loading daily scores:', error);
                // Return empty objects for failed loads
                uncachedMemberIds.forEach(memberId => {
                    if (!results[memberId]) {
                        results[memberId] = { scores: {}, reviewedScores: {} };
                    }
                });
            }
        }

        return results;
    },

    // Enhanced single member load with caching
    async loadDailyScores(memberId, teamCode, date) {
        if (!memberId || !teamCode || !date) {
            return { scores: {}, reviewedScores: {} };
        }

        // Check cache first
        const cacheKey = this._getCacheKey(memberId, teamCode, date);
        const cached = this._dailyScoresCache.get(cacheKey);

        if (this._isCacheValid(cached)) {
            return cached.data;
        }

        // Load from Firestore
        const { db } = window.appUtils;
        try {
            const docRef = db
                .collection('scores')
                .doc(date)
                .collection(teamCode)
                .doc(memberId);

            const snapshot = await docRef.get();

            const result = snapshot.exists
                ? {
                    scores: snapshot.data()?.scores || {},
                    reviewedScores: snapshot.data()?.reviewedScores || {}
                }
                : { scores: {}, reviewedScores: {} };

            // Cache the result
            this._dailyScoresCache.set(cacheKey, {
                data: result,
                timestamp: Date.now()
            });

            return result;
        } catch (error) {
            console.error('Error loading daily scores:', error);
            return { scores: {}, reviewedScores: {} };
        }
    },

    // Enhanced save with cache invalidation
    async saveDailyScores(memberId, teamCode, date, product, numScore) {
        const { db } = window.appUtils;
        try {
            await db.collection('scores')
                .doc(date)
                .collection(teamCode)
                .doc(memberId)
                .set({
                    scores: {
                        [product]: numScore
                    },
                    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
                }, { merge: true });

            // Invalidate cache for this member
            const cacheKey = this._getCacheKey(memberId, teamCode, date);
            this._dailyScoresCache.delete(cacheKey);

            return true;
        } catch (error) {
            console.error('Error saving daily scores:', error);
            return false;
        }
    },

    // Enhanced save reviewed scores with cache invalidation
    async saveDailyreviewedScores(memberId, teamCode, date, product, numScore) {
        const { db } = window.appUtils;
        try {
            await db.collection('scores')
                .doc(date)
                .collection(teamCode)
                .doc(memberId)
                .set({
                    reviewedScores: {
                        [product]: numScore
                    },
                    reviewedAt: firebase.firestore.FieldValue.serverTimestamp()
                }, { merge: true });

            // Invalidate cache for this member
            const cacheKey = this._getCacheKey(memberId, teamCode, date);
            this._dailyScoresCache.delete(cacheKey);

            return true;
        } catch (error) {
            console.error('Error saving daily reviewed scores:', error);
            return false;
        }
    },

    // Batch save scores (useful for admin operations)
    async saveBatchDailyScores(updates, date) {
        const { db } = window.appUtils;
        const batch = db.batch();

        try {
            updates.forEach(({ memberId, teamCode, product, score, isReviewed = false }) => {
                const docRef = db.collection('scores')
                    .doc(date)
                    .collection(teamCode)
                    .doc(memberId);

                const updateData = isReviewed
                    ? {
                        reviewedScores: { [product]: score },
                        reviewedAt: firebase.firestore.FieldValue.serverTimestamp()
                    }
                    : {
                        scores: { [product]: score },
                        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
                    };

                batch.set(docRef, updateData, { merge: true });

                // Invalidate cache
                const cacheKey = this._getCacheKey(memberId, teamCode, date);
                this._dailyScoresCache.delete(cacheKey);
            });

            await batch.commit();
            return true;
        } catch (error) {
            console.error('Error in batch save:', error);
            return false;
        }
    },

    // Get scores for date range (useful for analytics)
    async loadScoresForDateRange(teamCode, startDate, endDate, memberIds = null) {
        const { db } = window.appUtils;
        const results = {};

        try {
            // Get all dates in range
            const dates = this._getDateRange(startDate, endDate);

            for (const date of dates) {
                const collectionRef = db.collection('scores').doc(date).collection(teamCode);
                let query = collectionRef;

                // If specific members requested, filter by them
                if (memberIds && memberIds.length > 0) {
                    // Handle batching for 'in' queries (limit of 10)
                    const batches = [];
                    for (let i = 0; i < memberIds.length; i += 10) {
                        batches.push(memberIds.slice(i, i + 10));
                    }

                    for (const batch of batches) {
                        const snapshot = await query.where('__name__', 'in', batch).get();
                        snapshot.forEach(doc => {
                            const memberId = doc.id;
                            if (!results[memberId]) results[memberId] = {};
                            results[memberId][date] = {
                                scores: doc.data()?.scores || {},
                                reviewedScores: doc.data()?.reviewedScores || {}
                            };
                        });
                    }
                } else {
                    // Get all members for this date
                    const snapshot = await query.get();
                    snapshot.forEach(doc => {
                        const memberId = doc.id;
                        if (!results[memberId]) results[memberId] = {};
                        results[memberId][date] = {
                            scores: doc.data()?.scores || {},
                            reviewedScores: doc.data()?.reviewedScores || {}
                        };
                    });
                }
            }

            return results;
        } catch (error) {
            console.error('Error loading date range scores:', error);
            return {};
        }
    },

    // Helper function to generate date range
    _getDateRange(startDate, endDate) {
        const dates = [];
        const current = new Date(startDate);
        const end = new Date(endDate);

        while (current <= end) {
            dates.push(current.toISOString().split('T')[0]);
            current.setDate(current.getDate() + 1);
        }

        return dates;
    },

    // Clean up old cache entries periodically
    cleanupCache() {
        const now = Date.now();
        const keysToDelete = [];

        for (const [key, entry] of this._dailyScoresCache.entries()) {
            if (now - entry.timestamp > this._cacheExpiry) {
                keysToDelete.push(key);
            }
        }

        keysToDelete.forEach(key => this._dailyScoresCache.delete(key));
    }
};

// Helper functions for score calculations (used by multiple modules)
window.scoreUtils = {
    getEffectiveScores(memberData) {
        const reviewedScores = memberData?.reviewedScores || {};
        const regularScores = memberData?.scores || {};
        const hasReviewedScores = Object.values(reviewedScores).some(score => score > 0);
        return hasReviewedScores ? reviewedScores : regularScores;
    },

    calculateTotalScore(memberData) {
        const effectiveScores = window.scoreUtils.getEffectiveScores(memberData);
        return products.reduce((sum, product) => sum + (effectiveScores[product] || 0), 0);
    }
};

// Data export/import utilities
window.dataUtils = {
    async exportCollection(collectionName) {
        const snapshot = await db.collection(collectionName).get();
        const docs = snapshot.docs.map(doc => ({
            id: doc.id,
            data: doc.data()
        }));

        const blob = new Blob([JSON.stringify(docs, null, 2)], { type: "application/json" });
        const url = URL.createObjectURL(blob);

        const a = document.createElement("a");
        a.href = url;
        a.download = `${collectionName}.json`;
        a.click();
        URL.revokeObjectURL(url);
    },

    importCollection() {
        const overlay = document.createElement("div");
        overlay.style.cssText = `
            position: fixed; top: 0; left: 0; width: 100vw; height: 100vh;
            background: rgba(0,0,0,0.5); display: flex; align-items: center;
            justify-content: center; z-index: 9999;
        `;

        const modal = document.createElement("div");
        modal.style.cssText = `
            background: #fff; padding: 20px; border-radius: 10px;
            box-shadow: 0 0 10px #333;
        `;
        modal.innerHTML = `
            <h3>📁 Import JSON to Firestore</h3>
            <input type="file" accept=".json" id="importFile" />
            <br/><br/>
            <button id="importGo">Import</button>
            <button id="importCancel">Cancel</button>
        `;
        overlay.appendChild(modal);
        document.body.appendChild(overlay);

        document.getElementById("importCancel").onclick = () => {
            document.body.removeChild(overlay);
        };

        document.getElementById("importGo").onclick = async () => {
            const input = document.getElementById("importFile");
            const file = input.files[0];
            if (!file) return;

            try {
                const fileName = file.name.replace(/\.[^/.]+$/, "");
                const text = await file.text();
                const docs = JSON.parse(text);

                for (const doc of docs) {
                    await db.collection(fileName).doc(doc.id).set(doc.data);
                }

                console.log(`✅ Imported ${docs.length} docs into "${fileName}"`);
            } catch (err) {
                console.error("❌ Import error:", err);
            }

            document.body.removeChild(overlay);
        };
    }
};

// Add after your existing utility functions
function updateAuthUI(user) {
    const loginBtn = document.querySelector('.login-btn');
    const logoutBtn = document.querySelector('.logout-btn');

    if (user) {
        // User is logged in
        if (loginBtn) loginBtn.style.display = 'none';
        if (logoutBtn) logoutBtn.style.display = 'inline-block';
    } else {
        // User is logged out
        if (loginBtn) loginBtn.style.display = 'inline-block';
        if (logoutBtn) logoutBtn.style.display = 'none';
    }
}
async function initializeAuthStateListener(authModule) {
    if (!authModule) {
        // Load the auth module first
        const authModule = await window.moduleLoader.loadModule('auth');
    }  

    // Use AuthModule.onAuthStateChanged
    authModule.onAuthStateChanged((user) => {
        updateAuthUI(user);

        if (user) {
            console.log('User logged in:', user.email);
            window.appUtils.setCurrentTeamCode(user.uid);
        } else {
            console.log('User logged out');
            window.appUtils.setCurrentTeamCode(null);
            window.appUtils.setTeamMembers([]);
        }
    });
}

// Update your initializeApp function
async function initializeApp() {
    // Initial UI update based on current auth state
    const authModule = await window.moduleLoader.loadModule('auth');
    // Initialize auth state listener first
    initializeAuthStateListener(authModule);
    setTimeout(async () => {
        const currentUser = authModule.getCurrentUser();       
        if (currentUser) {
            const teamDoc = await db.collection('teams').doc(currentUser.uid).get();
            if (teamDoc.exists) {
                window.appUtils.setCurrentTeamCode(currentUser.uid);

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
                await showLeaderboard();
            }
          
        } else {
            await showLeaderboard();
        }
        updateAuthUI(currentUser);
    }, 500); // Delay by 2 seconds
    // Auto cleanup cache every 10 minutes
    setInterval(() => {
        window.appUtils.cleanupCache();
    }, 10 * 60 * 1000);
}

document.addEventListener('DOMContentLoaded', initializeApp);