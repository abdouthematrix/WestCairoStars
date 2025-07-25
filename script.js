//==========================Main==================================//
// Firebase Configuration (Replace with your config)
const firebaseConfig = {
    // Add your Firebase config here
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
// Dynamic Page Loader
function loadPage(page) {
    fetch(`Pages/${page}.html`)
        .then(response => response.text())
        .then(html => {
            document.getElementById('app').innerHTML = html;
            // Re-initialize language and any page-specific logic
            toggleLanguage();
            if (page === 'leaderboard') {
                loadLeaderboards();
            } else if (page === 'dashboard') {
                if (currentTeamCode) {
                    loadTeamMembers();
                }
            } else if (page === 'admin') {
                loadAllTeamsForAdmin();
            }
        });
}
function showLeaderboard() {
    loadPage('leaderboard');
}
function showDashboard() {
    loadPage('dashboard');
}
function showLogin() {
    loadPage('login');
}
function showAdmin() {
    loadPage('admin');
}

// Consolidated initialization
function initializeApp() {
    showLeaderboard();
    // Set initial language after DOM is ready and header is present
    setTimeout(() => {
        toggleLanguage();
        toggleLanguage(); // Call twice to set to Arabic by default
    }, 0);
}

document.addEventListener('DOMContentLoaded', initializeApp);

// Helper function to get the appropriate scores (reviewed if exists, otherwise regular scores)
function getEffectiveScores(memberData) {
    const reviewedScores = memberData.reviewedScores || {};
    const regularScores = memberData.scores || {};

    // Check if any reviewed scores exist
    const hasReviewedScores = Object.values(reviewedScores).some(score => score > 0);

    // Use reviewed scores if they exist, otherwise fall back to regular scores
    return hasReviewedScores ? reviewedScores : regularScores;
}
// Helper function to calculate total score from effective scores
function calculateTotalScore(memberData) {
    const effectiveScores = getEffectiveScores(memberData);
    return products.reduce((sum, product) => sum + (effectiveScores[product] || 0), 0);
}

async function exportCollection(collectionName) {
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
}
function importCollection() {
    // Create overlay
    const overlay = document.createElement("div");
    overlay.style.position = "fixed";
    overlay.style.top = "0";
    overlay.style.left = "0";
    overlay.style.width = "100vw";
    overlay.style.height = "100vh";
    overlay.style.background = "rgba(0,0,0,0.5)";
    overlay.style.display = "flex";
    overlay.style.alignItems = "center";
    overlay.style.justifyContent = "center";
    overlay.style.zIndex = "9999";

    // Create modal
    const modal = document.createElement("div");
    modal.style.background = "#fff";
    modal.style.padding = "20px";
    modal.style.borderRadius = "10px";
    modal.style.boxShadow = "0 0 10px #333";
    modal.innerHTML = `
        <h3>📁 Import JSON to Firestore</h3>
        <input type="file" accept=".json" id="importFile" />
        <br/><br/>
        <button id="importGo">Import</button>
        <button id="importCancel">Cancel</button>
    `;
    overlay.appendChild(modal);
    document.body.appendChild(overlay);

    // Handle Cancel
    document.getElementById("importCancel").onclick = () => {
        document.body.removeChild(overlay);
    };

    // Handle Import
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

//==========================Login View==================================//
// Login Handler
async function handleLogin(event) {
    event.preventDefault();
    const username = document.getElementById('userName').value.trim();
    const userpassword = document.getElementById('userPassword').value.trim();
    if (!username || !userpassword) {
        alert("Username and password required");
        return;
    }
    const email = username + '@westcairo.com'; 

    try {
        const userCredential = await firebase.auth().signInWithEmailAndPassword(email, userpassword);      
        const teamDoc = await db.collection('teams').doc(userCredential.user.uid).get();

        if (teamDoc.exists) {
            currentTeamCode = userCredential.user.uid;            
           
            if (teamDoc.data().isAdmin) {
                showAdmin();               
            } else {
                showDashboard();
                // Wait a bit for the dashboard to load, then set team name and load members
                setTimeout(() => {  
                    const teamNameElem = document.getElementById('teamName');
                    if (teamNameElem) {
                        teamNameElem.textContent = teamDoc.data().name || teamCode;
                    }
                    loadTeamMembers();
                }, 100);
            }
        } else {
            alert(currentLanguage === 'ar' ? 'رمز الفريق غير صحيح' : 'Invalid team code');
        }
    } catch (error) {
        console.error('Login error:', error);
        alert(currentLanguage === 'ar' ? 'خطأ في تسجيل الدخول' : 'Login error');
    }
}
// Logout
function logout() {
    firebase.auth().signOut()
        .then(() => {
            console.log("Logged out successfully");
            currentTeamCode = null;
            showLeaderboard();
        })
        .catch(error => {
            console.error("Logout error:", error);
            alert("Logout failed");
        });
}

//==========================dashboard View==================================//
// Load Team Members
async function loadTeamMembers() {
    try {
        const membersSnapshot = await db.collection('teamMembers')
            .where('teamCode', '==', currentTeamCode)
            .get();

        teamMembers = [];
        membersSnapshot.forEach(doc => {
            teamMembers.push({
                id: doc.id,
                ...doc.data()
            });
        });

        renderMembersTable();
    } catch (error) {
        console.error('Error loading team members:', error);
    }
}
// Updated renderMembersTable function to show both scores and reviewed scores
function renderMembersTable() {
    const tbody = document.getElementById('membersTable');
    if (!tbody) return;

    tbody.innerHTML = '';

    teamMembers.forEach(member => {
        const row = document.createElement('tr');
        const regularScores = member.scores || {};
        const reviewedScores = member.reviewedScores || {};
        const effectiveScores = getEffectiveScores(member);
        const total = calculateTotalScore(member);

        // Check if reviewed scores exist
        const hasReviewedScores = Object.values(reviewedScores).some(score => score > 0);

        row.innerHTML = `
            <td>${member.name}</td>
            ${products.map(product => {
            const regularScore = regularScores[product] || 0;
            const reviewedScore = reviewedScores[product] || 0;
            const effectiveScore = effectiveScores[product] || 0;

            return `
                    <td>
                        <input type="number" 
                               class="score-input" 
                               value="${regularScore}"
                               onchange="updateMemberScore('${member.id}', '${product}', this.value)"
                               min="0">
                        ${hasReviewedScores ? `
                            <div class="reviewed-score" style="font-size: 0.8em; color: #059669; margin-top: 2px;">
                                ${currentLanguage === 'ar' ? 'تم احتسابه' : 'Reviewed'}: ${reviewedScore}
                            </div>
                        ` : ''}
                    </td>
                `;
        }).join('')}
            <td>
                <strong>${total}</strong>
                ${hasReviewedScores ? `
                    <div style="font-size: 0.8em; color: #059669;">
                        (${currentLanguage === 'ar' ? 'تم احتسابه' : 'Reviewed'})
                    </div>
                ` : ''}
            </td>
            <td class="action-btns">
                <button data-en="Edit" data-ar="تعديل" class="edit-btn" onclick="editMember('${member.id}')">${currentLanguage === 'ar' ? 'تعديل' : 'Edit'}</button>
                <button data-en="Delete" data-ar="حذف" class="delete-btn" onclick="deleteMember('${member.id}')">${currentLanguage === 'ar' ? 'حذف' : 'Delete'}</button>
            </td>
        `;
        tbody.appendChild(row);
    });
}
// Add Member
async function addMember() {
    const name = prompt(currentLanguage === 'ar' ? 'اسم العضو الجديد:' : 'New member name:');
    if (!name) return;

    try {
        const newMember = {
            name: name.trim(),
            teamCode: currentTeamCode,
            scores: {
                securedLoan: 0,
                securedCreditCard: 0,
                unsecuredLoan: 0,
                unsecuredCreditCard: 0,
                bancassurance: 0
            },
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        };

        await db.collection('teamMembers').add(newMember);

        teamMembers.push({
            id: memberId,
            ...newMember
        });
        renderMembersTable();
    } catch (error) {
        console.error('Error adding member:', error);
        alert(currentLanguage === 'ar' ? 'خطأ في إضافة العضو' : 'Error adding member');
    }
}
// Edit Member
function editMember(memberId) {
    const member = teamMembers.find(m => m.id === memberId);
    if (!member) return;

    const newName = prompt(
        currentLanguage === 'ar' ? 'تعديل اسم العضو:' : 'Edit member name:',
        member.name
    );

    if (newName && newName.trim() !== member.name) {
        updateMemberName(memberId, newName.trim());
    }
}
// Delete Member
async function deleteMember(memberId) {
    if (!confirm(currentLanguage === 'ar' ? 'هل أنت متأكد من حذف هذا العضو؟' : 'Are you sure you want to delete this member?')) {
        return;
    }

    try {
        await db.collection('teamMembers').doc(memberId).delete();
        teamMembers = teamMembers.filter(m => m.id !== memberId);
        renderMembersTable();
    } catch (error) {
        console.error('Error deleting member:', error);
    }
}

// Update Member Score
async function updateMemberScore(memberId, product, score) {
    try {
        const numScore = parseInt(score) || 0;
        await db.collection('teamMembers').doc(memberId).update({
            [`scores.${product}`]: numScore,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        });

        // Update local data
        const member = teamMembers.find(m => m.id === memberId);
        if (member) {
            if (!member.scores) member.scores = {};
            member.scores[product] = numScore;
        }

        renderMembersTable();
    } catch (error) {
        console.error('Error updating score:', error);
    }
}
// Update Member Name
async function updateMemberName(memberId, name) {
    try {
        await db.collection('teamMembers').doc(memberId).update({
            name: name,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        });

        const member = teamMembers.find(m => m.id === memberId);
        if (member) {
            member.name = name;
        }

        renderMembersTable();
    } catch (error) {
        console.error('Error updating member name:', error);
    }
}

//=========================Leaderboard View==================================//
// Load Leaderboard Data
async function loadLeaderboards() {
    try {
        await Promise.all([
            loadTopAchievers(),
            loadTopTeams(),
            loadTopTeamLeaders()
        ]);
    } catch (error) {
        console.error('Error loading leaderboards:', error);
    }
}
// Updated Load Top Achievers function
async function loadTopAchievers() {
    try {
        const snapshot = await db.collection('teamMembers').get();
        const achievers = [];

        snapshot.forEach(doc => {
            const data = doc.data();
            const effectiveScores = getEffectiveScores(data);
            const productsWithScore = products.filter(p => effectiveScores[p] > 0).length;

            if (productsWithScore >= 2) {
                const totalScore = calculateTotalScore(data);
                achievers.push({
                    name: data.name,
                    score: totalScore,
                    teamCode: data.teamCode
                });
            }
        });

        achievers.sort((a, b) => b.score - a.score);
        renderLeaderboard('top-achievers', achievers.slice(0, 10));
    } catch (error) {
        console.error('Error loading top achievers:', error);
    }
}
// Updated Load Top Teams function
async function loadTopTeams() {
    try {
        const teamsSnapshot = await db.collection('teams').get();
        const teams = [];

        for (const teamDoc of teamsSnapshot.docs) {
            const teamData = teamDoc.data();

            // Skip admin teams from leaderboard
            if (teamData.isAdmin) continue;

            const membersSnapshot = await db.collection('teamMembers')
                .where('teamCode', '==', teamDoc.id)
                .get();

            let allMembersActive = true;
            let totalScore = 0;

            membersSnapshot.forEach(memberDoc => {
                const memberData = memberDoc.data();
                const memberTotal = calculateTotalScore(memberData);

                if (memberTotal === 0) {
                    allMembersActive = false;
                }
                totalScore += memberTotal;
            });

            if (allMembersActive && membersSnapshot.size > 0 && teamData.leader) {
                teams.push({
                    name: teamData.leader,
                    team: teamData.name || teamDoc.id,
                    score: totalScore
                });
            }
        }

        teams.sort((a, b) => b.score - a.score);
        renderLeaderboard('top-leaders', teams.slice(0, 10));
    } catch (error) {
        console.error('Error loading top team leaders:', error);
    }
}
// Updated Load Top Team Leaders function
async function loadTopTeamLeaders() {
    try {
        const teamsSnapshot = await db.collection('teams').get();
        const leaders = [];

        for (const teamDoc of teamsSnapshot.docs) {
            const teamData = teamDoc.data();

            // Skip admin teams from leaderboard
            if (teamData.isAdmin) continue;

            const membersSnapshot = await db.collection('teamMembers')
                .where('teamCode', '==', teamDoc.id)
                .get();

            let allMembersActive = true;
            let totalScore = 0;

            membersSnapshot.forEach(memberDoc => {
                const memberData = memberDoc.data();
                const memberTotal = calculateTotalScore(memberData);

                if (memberTotal === 0) {
                    allMembersActive = false;
                }
                totalScore += memberTotal;
            });

            if (allMembersActive && membersSnapshot.size > 0) {
                leaders.push({
                    name: teamData.name || teamDoc.id,
                    score: totalScore
                });
            }
        }

        leaders.sort((a, b) => b.score - a.score);
        renderLeaderboard('top-teams', leaders.slice(0, 10));
    } catch (error) {
        console.error('Error loading top teams:', error);
    }
}
// Enhanced Render Leaderboard with score type indicator
function renderLeaderboard(containerId, data) {
    const container = document.getElementById(containerId);
    if (!container) return;

    if (data.length === 0) {
        container.innerHTML = `<p style="text-align: center; color: var(--text-secondary); padding: 20px;">${currentLanguage === 'ar' ? 'لا توجد بيانات' : 'No data available'}</p>`;
        return;
    }

    container.innerHTML = data.map((item, index) => {
        const trophy = index === 0 ? '🏆' : index === 1 ? '🥈' : index === 2 ? '🥉' : '';
        return `
            <div class="leaderboard-item">
                <span class="rank">#${index + 1}</span>
                <span class="name">${item.name}${item.team ? ` (${item.team})` : ''}</span>
                <span class="score">
                    ${item.score} 
                    <span class="trophy">${trophy}</span>
                </span>
            </div>
        `;
    }).join('');
}


//=========================Admin View==================================//
// Enhanced loadAllTeamsForAdmin function with admin team protection
async function loadAllTeamsForAdmin() {
    const container = document.getElementById('admin-teams-container');
    if (!container) return;
    container.innerHTML = '<div class="loading"><div class="spinner"></div></div>';
    try {
        // Query 1: Get admin teams first
        const adminTeamsSnapshot = await db.collection('teams')
            .where('isAdmin', '==', true)
            .get();

        // Query 2: Get non-admin teams
        const regularTeamsSnapshot = await db.collection('teams')
            .where('isAdmin', '==', false)
            .get();

        let html = `
            <div class="admin-header">
                <h2 data-en="Team Management" data-ar="إدارة الفرق">إدارة الفرق</h2>
                <button class="btn btn-primary" onclick="createNewTeam()" data-en="+ Create New Team" data-ar="+ إنشاء فريق جديد">+ إنشاء فريق جديد</button>
                <button id="resetAllScoresBtn" class="btn btn-danger" onclick="resetAllScores()" data-en="🔄 Reset All Scores" data-ar="🔄 إعادة تعيين جميع الدرجات">🔄 إعادة تعيين جميع الدرجات</button>
            </div>
        `;

        // Helper function to render team
        const renderTeam = async (teamDoc, isAdminTeam) => {
            const team = teamDoc.data();
            const teamId = teamDoc.id;

            // Get team members
            const membersSnapshot = await db.collection('teamMembers')
                .where('teamCode', '==', teamId)
                .get();

            return `
                <div class="admin-section ${isAdminTeam ? 'admin-team-section' : ''}">
                    <div class="team-header">
                        <div class="team-info">
                            <h3>${team.name || teamId} ${isAdminTeam ? '<span class="admin-badge" data-en="ADMIN" data-ar="إدارة">إدارة</span>' : ''}</h3>
                            <p class="team-code">UID: ${teamId}</p>
                            ${!isAdminTeam && team.leader ? `<p class="team-leader">Leader: ${team.leader}</p>` : ''}
                        </div>
                        <div class="team-actions">
                            ${!isAdminTeam ? `
                                <button class="edit-btn btn-small" onclick="editTeamInfo('${teamId}', '${team.name}', '${team.leader}')" data-en="Edit Team" data-ar="تعديل الفريق">تعديل الفريق</button>
                                <button class="edit-btn btn-small" onclick="editTeamLeader('${teamId}', '${team.leader}')" data-en="Edit Leader" data-ar="تعديل القائد">تعديل القائد</button>
                                <button class="edit-btn btn-small" onclick="changeTeamCode('${teamId}', '${team.name}')" data-en="Change Code" data-ar="تغيير الرمز">تغيير الرمز</button>
                                <button class="delete-btn btn-small" onclick="deleteTeam('${teamId}', '${team.name}')" data-en="Delete Team" data-ar="حذف الفريق">حذف الفريق</button>
                            ` : `
                                <span class="admin-protected-text" data-en="Admin Team - Protected" data-ar="فريق الإدارة - محمي">فريق الإدارة - محمي</span>
                            `}
                        </div>
                    </div>
                    
                    <div class="members-section">
                        <div class="members-header">
                            <h4 data-en="Team Members" data-ar="أعضاء الفريق">أعضاء الفريق</h4>
                            ${!isAdminTeam ? `
                                <button class="btn btn-success btn-small" onclick="addMemberToTeam('${teamId}')" data-en="+ Add Member" data-ar="+ إضافة عضو">+ إضافة عضو</button>
                                <button class="btn btn-warning btn-small" onclick="resetTeamScores('${teamId}', '${team.name}')" data-en="🔄 Reset Team" data-ar="🔄 إعادة تعيين الفريق">🔄 إعادة تعيين الفريق</button>
                            ` : ''}
                        </div>
                        
                        <table class="members-table">
                            <thead>
                                <tr>
                                    <th data-en="Name" data-ar="الاسم">الاسم</th>
                                    ${products.map(product => `<th>${product}</th>`).join('')}
                                    <th data-en="Total" data-ar="المجموع">المجموع</th>
                                    <th data-en="Actions" data-ar="الإجراءات">الإجراءات</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${membersSnapshot.docs.map(memberDoc => renderEnhancedAdminMemberRow(memberDoc, isAdminTeam)).join('')}
                                ${isAdminTeam && membersSnapshot.docs.length === 0 ? `
                                    <tr><td colspan="${products.length + 3}" class="no-members" data-en="Admin team - No members required" data-ar="فريق الإدارة - لا يتطلب أعضاء">فريق الإدارة - لا يتطلب أعضاء</td></tr>
                                ` : ''}
                            </tbody>
                        </table>
                    </div>
                </div>
            `;
        };

        // Render admin teams first
        for (const teamDoc of adminTeamsSnapshot.docs) {
            html += await renderTeam(teamDoc, true);
        }

        // Then render regular teams
        for (const teamDoc of regularTeamsSnapshot.docs) {
            html += await renderTeam(teamDoc, false);
        }

        container.innerHTML = html;
        // Update language for new elements
        document.querySelectorAll('[data-en][data-ar]').forEach(element => {
            element.textContent = element.getAttribute(`data-${currentLanguage}`);
        });
    } catch (error) {
        console.error('Error loading teams for admin:', error);
        container.innerHTML = `<p style="color:var(--danger-color);">${currentLanguage === 'ar' ? 'حدث خطأ أثناء تحميل الفرق' : 'Error loading teams'}</p>`;
    }
}
// Enhanced renderEnhancedAdminMemberRow function with admin team protection
function renderEnhancedAdminMemberRow(memberDoc, isAdminTeam = false) {
    const member = memberDoc.data();
    const memberId = memberDoc.id;
    const reviewed = member.reviewedScores || {};
    const scores = member.scores || {};
    const total = Object.values(reviewed).reduce((sum, score) => sum + (parseInt(score) || 0), 0);
    return `
        <tr id="admin-member-row-${memberId}" class="member-row ${isAdminTeam ? 'admin-team-row' : ''}">
            <td>${member.name}</td>
            ${products.map(product => `
                <td>
                    <input type="number" 
                           min="0" 
                           class="score-input" 
                           value="${reviewed[product] || ''}" 
                           id="reviewed-${memberId}-${product}"
                           ${isAdminTeam ? 'disabled' : ''}
                           onchange="autoSaveScore('${memberId}', '${product}', this.value)">
                           <div class="original-score" style="font-size: 0.8em; color: #059669; margin-top: 2px;">${scores[product] || '0'}</div>   
                </td>
            `).join('')}
            <td><strong>${total}</strong></td>
            <td class="action-btns">
                ${!isAdminTeam ? `
                    <button class="edit-btn btn-small" onclick="editMemberName('${memberId}', '${member.name}')" data-en="Edit" data-ar="تعديل">تعديل</button>
                    <button class="delete-btn btn-small" onclick="removeMemberFromTeam('${memberId}', '${member.name}')" data-en="Remove" data-ar="حذف">حذف</button>
                ` : `
                    <span class="admin-protected" data-en="Protected" data-ar="محمي">محمي</span>
                `}
            </td>
        </tr>
    `;
}

async function reviewTeamScores() {
    const resultsContainer = document.getElementById('admin-review-results');
    if (!resultsContainer) return;
    resultsContainer.innerHTML = '<div class="loading"><div class="spinner"></div></div>';
    try {
        const reviewData = await AdminFunctions.reviewTeamScores();
        if (!reviewData.length) {
            resultsContainer.innerHTML = `<p style="text-align:center; color:var(--text-secondary);">${currentLanguage === 'ar' ? 'لا توجد بيانات' : 'No data available'}</p>`;
            return;
        }
        resultsContainer.innerHTML = reviewData.map(team => `
            <div class="admin-team-review">
                <h4>${team.teamName || team.teamId}</h4>
                <ul>
                    ${team.members.map(member => `<li>${member.name}: ${Object.values(member.scores).reduce((a,b)=>a+b,0)}</li>`).join('')}
                </ul>
            </div>
        `).join('');
    } catch (error) {
        resultsContainer.innerHTML = `<p style="color:var(--danger-color);">${currentLanguage === 'ar' ? 'حدث خطأ أثناء التم احتسابهة' : 'Error during review'}</p>`;
    }
}
// --- TEAM MANAGEMENT FUNCTIONS ---
// Create New Team
async function createNewTeam() {
    const teamName = prompt(currentLanguage === 'ar' ? 'اسم الفريق الجديد:' : 'New team name:');
    if (!teamName || !teamName.trim()) return;

    const teamCode = prompt(currentLanguage === 'ar' ? 'رمز الفريق (يجب أن يكون فريداً):' : 'Team code (must be unique):');
    if (!teamCode || !teamCode.trim()) return;

    const leaderName = prompt(currentLanguage === 'ar' ? 'اسم قائد الفريق:' : 'Team leader name:');
    if (!leaderName || !leaderName.trim()) return;

    try {
        // Check if team code already exists
        const existingTeam = await db.collection('teams').doc(teamCode.trim()).get();
        if (existingTeam.exists) {
            alert(currentLanguage === 'ar' ? 'رمز الفريق موجود بالفعل' : 'Team code already exists');
            return;
        }

        // Create new team
        await db.collection('teams').doc(teamCode.trim()).set({
            name: teamName.trim(),
            leader: leaderName.trim(),
            isAdmin: false,
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });

        alert(currentLanguage === 'ar' ? 'تم إنشاء الفريق بنجاح' : 'Team created successfully');
        loadAllTeamsForAdmin(); // Refresh the admin view
    } catch (error) {
        console.error('Error creating team:', error);
        alert(currentLanguage === 'ar' ? 'خطأ في إنشاء الفريق' : 'Error creating team');
    }
}
// Enhanced Delete Team function with admin protection
async function deleteTeam(teamId, teamName) {
    try {
        // Check if this is an admin team
        const teamDoc = await db.collection('teams').doc(teamId).get();
        if (teamDoc.exists && teamDoc.data().isAdmin) {
            alert(currentLanguage === 'ar'
                ? 'لا يمكن حذف فريق الإدارة'
                : 'Cannot delete admin team');
            return;
        }

        if (!confirm(
            currentLanguage === 'ar'
                ? `هل أنت متأكد من حذف فريق "${teamName}"؟ سيتم حذف جميع أعضاء الفريق أيضاً.`
                : `Are you sure you want to delete team "${teamName}"? This will also delete all team members.`
        )) return;

        // Delete all team members first
        const membersSnapshot = await db.collection('teamMembers')
            .where('teamCode', '==', teamId)
            .get();

        const batch = db.batch();
        membersSnapshot.forEach(doc => {
            batch.delete(doc.ref);
        });
        await batch.commit();

        // Delete team document
        await db.collection('teams').doc(teamId).delete();

        alert(currentLanguage === 'ar' ? 'تم حذف الفريق بنجاح' : 'Team deleted successfully');
        loadAllTeamsForAdmin();
    } catch (error) {
        console.error('Error deleting team:', error);
        alert(currentLanguage === 'ar' ? 'خطأ في حذف الفريق' : 'Error deleting team');
    }
}
// Edit Team Information
async function editTeamInfo(teamId, currentName, currentLeader) {
    const newName = prompt(
        currentLanguage === 'ar' ? 'تعديل اسم الفريق:' : 'Edit team name:',
        currentName
    );
    if (!newName || newName.trim() === currentName) return;

    try {
        await db.collection('teams').doc(teamId).update({
            name: newName.trim(),
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        });

        alert(currentLanguage === 'ar' ? 'تم تحديث اسم الفريق بنجاح' : 'Team name updated successfully');
        loadAllTeamsForAdmin();
    } catch (error) {
        console.error('Error updating team name:', error);
        alert(currentLanguage === 'ar' ? 'خطأ في تحديث اسم الفريق' : 'Error updating team name');
    }
}
// Edit Team Leader
async function editTeamLeader(teamId, currentLeader) {
    const newLeader = prompt(
        currentLanguage === 'ar' ? 'تعديل اسم قائد الفريق:' : 'Edit team leader name:',
        currentLeader
    );
    if (!newLeader || newLeader.trim() === currentLeader) return;

    try {
        await db.collection('teams').doc(teamId).update({
            leader: newLeader.trim(),
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        });

        alert(currentLanguage === 'ar' ? 'تم تحديث قائد الفريق بنجاح' : 'Team leader updated successfully');
        loadAllTeamsForAdmin();
    } catch (error) {
        console.error('Error updating team leader:', error);
        alert(currentLanguage === 'ar' ? 'خطأ في تحديث قائد الفريق' : 'Error updating team leader');
    }
}

//--- TEAM MEMBER MANAGEMENT FUNCTIONS ---
// Add Member to Team
async function addMemberToTeam(teamCode) {
    const memberName = prompt(currentLanguage === 'ar' ? 'اسم العضو الجديد:' : 'New member name:');
    if (!memberName || !memberName.trim()) return;

    try {
        const newMember = {
            name: memberName.trim(),
            teamCode: teamCode,
            scores: {
                securedLoan: 0,
                securedCreditCard: 0,
                unsecuredLoan: 0,
                unsecuredCreditCard: 0,
                bancassurance: 0
            },
            reviewedScores: {
                securedLoan: 0,
                securedCreditCard: 0,
                unsecuredLoan: 0,
                unsecuredCreditCard: 0,
                bancassurance: 0
            },
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        };

        await db.collection('teamMembers').add(newMember);
        alert(currentLanguage === 'ar' ? 'تم إضافة العضو بنجاح' : 'Member added successfully');
        loadAllTeamsForAdmin();
    } catch (error) {
        console.error('Error adding member:', error);
        alert(currentLanguage === 'ar' ? 'خطأ في إضافة العضو' : 'Error adding member');
    }
}
// Edit Member Name
async function editMemberName(memberId, currentName) {
    const newName = prompt(
        currentLanguage === 'ar' ? 'تعديل اسم العضو:' : 'Edit member name:',
        currentName
    );
    if (!newName || newName.trim() === currentName) return;

    try {
        await db.collection('teamMembers').doc(memberId).update({
            name: newName.trim(),
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        });

        alert(currentLanguage === 'ar' ? 'تم تحديث اسم العضو بنجاح' : 'Member name updated successfully');
        loadAllTeamsForAdmin();
    } catch (error) {
        console.error('Error updating member name:', error);
        alert(currentLanguage === 'ar' ? 'خطأ في تحديث اسم العضو' : 'Error updating member name');
    }
}
// Remove Member from Team
async function removeMemberFromTeam(memberId, memberName) {
    if (!confirm(
        currentLanguage === 'ar'
            ? `هل أنت متأكد من حذف العضو "${memberName}"؟`
            : `Are you sure you want to remove member "${memberName}"?`
    )) return;

    try {
        await db.collection('teamMembers').doc(memberId).delete();       
        alert(currentLanguage === 'ar' ? 'تم حذف العضو بنجاح' : 'Member removed successfully');
        loadAllTeamsForAdmin();
    } catch (error) {
        console.error('Error removing member:', error);
        alert(currentLanguage === 'ar' ? 'خطأ في حذف العضو' : 'Error removing member');
    }
}
// Auto-save score function for better UX
async function autoSaveScore(memberId, product, score) {
    try {
        const numScore = parseInt(score) || 0;
        const updateData = {};
        updateData[`reviewedScores.${product}`] = numScore;
        updateData.reviewedAt = firebase.firestore.FieldValue.serverTimestamp();

        await db.collection('teamMembers').doc(memberId).update(updateData);

        // Update total in the row
        const row = document.getElementById(`admin-member-row-${memberId}`);
        if (row) {
            const totalCell = row.querySelector('td:nth-last-child(2) strong');
            if (totalCell) {
                let newTotal = 0;
                products.forEach(prod => {
                    const input = document.getElementById(`reviewed-${memberId}-${prod}`);
                    if (input) newTotal += parseInt(input.value) || 0;
                });
                totalCell.textContent = newTotal;
            }

            // Visual feedback
            row.style.background = '#d1fae5';
            setTimeout(() => { row.style.background = ''; }, 1000);
        }
    } catch (error) {
        console.error('Error auto-saving score:', error);
    }
}
// Enhanced Change Team Code function with admin protection
async function changeTeamCode(oldTeamId, teamName) {
    try {
        // Check if this is an admin team
        const teamDoc = await db.collection('teams').doc(oldTeamId).get();
        if (teamDoc.exists && teamDoc.data().isAdmin) {
            alert(currentLanguage === 'ar'
                ? 'لا يمكن تغيير رمز فريق الإدارة'
                : 'Cannot change admin team code');
            return;
        }

        const newTeamCode = prompt(
            currentLanguage === 'ar' ? 'الرمز الجديد للفريق:' : 'New team code:',
            oldTeamId
        );
        if (!newTeamCode || newTeamCode.trim() === oldTeamId) return;

        // Check if new code already exists
        const existingTeam = await db.collection('teams').doc(newTeamCode.trim()).get();
        if (existingTeam.exists) {
            alert(currentLanguage === 'ar' ? 'رمز الفريق الجديد موجود بالفعل' : 'New team code already exists');
            return;
        }

        const teamData = teamDoc.data();

        // Create new team document with new code
        await db.collection('teams').doc(newTeamCode.trim()).set({
            ...teamData,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        });

        // Update all team members to use new team code
        const membersSnapshot = await db.collection('teamMembers')
            .where('teamCode', '==', oldTeamId)
            .get();

        const batch = db.batch();
        membersSnapshot.forEach(doc => {
            batch.update(doc.ref, { teamCode: newTeamCode.trim() });
        });
        await batch.commit();

        // Delete old team document
        await db.collection('teams').doc(oldTeamId).delete();

        alert(currentLanguage === 'ar' ? 'تم تغيير رمز الفريق بنجاح' : 'Team code changed successfully');
        loadAllTeamsForAdmin();
    } catch (error) {
        console.error('Error changing team code:', error);
        alert(currentLanguage === 'ar' ? 'خطأ في تغيير رمز الفريق' : 'Error changing team code');
    }
}
// Reset All Scores Function
async function resetAllScores() {
    const confirmMessage = currentLanguage === 'ar'
        ? 'هل أنت متأكد من إعادة تعيين جميع درجات جميع أعضاء الفرق؟ هذا الإجراء لا يمكن التراجع عنه!'
        : 'Are you sure you want to reset all scores for all team members? This action cannot be undone!';

    if (!confirm(confirmMessage)) return;

    // Second confirmation for safety
    const doubleConfirmMessage = currentLanguage === 'ar'
        ? 'تأكيد أخير: سيتم حذف جميع درجات الفريق. هل تريد المتابعة؟'
        : 'Final confirmation: All scores will be deleted. Do you want to continue?';

    if (!confirm(doubleConfirmMessage)) return;

    const resetButton = document.getElementById('resetAllScoresBtn');
    if (resetButton) {
        resetButton.disabled = true;
        resetButton.innerHTML = currentLanguage === 'ar' ? 'جاري الإعادة تعيين...' : 'Resetting...';
    }

    try {

        // Get all team members from all teams (excluding admin teams)
        const teamsSnapshot = await db.collection('teams').get();
        if (teamsSnapshot.empty) {
            console.log('No teams found');
            return [];
        }
        const teamCodes = teamsSnapshot.docs
            .filter(doc => {
                const data = doc.data();
                return !data.isAdmin; // This handles undefined/null/false
            })
            .map(doc => doc.id);
        if (teamsSnapshot.empty) {
            console.log('No teamCodes found');
            return [];
        }
        // Get all members from non-admin teams
        const membersSnapshot = await db.collection('teamMembers')
            .where('teamCode', 'in', teamCodes.length > 0 ? teamCodes : ['dummy'])
            .get();

        if (membersSnapshot.empty) {
            alert(currentLanguage === 'ar' ? 'لا توجد بيانات للإعادة تعيين' : 'No data to reset');
            return;
        }

        // Create batch update to reset all reviewed scores
        const batch = db.batch();
        const resetScores = {
            securedLoan: 0,
            securedCreditCard: 0,
            unsecuredLoan: 0,
            unsecuredCreditCard: 0,
            bancassurance: 0
        };

        membersSnapshot.forEach(doc => {
            batch.update(doc.ref, {
                scores: resetScores,
                reviewedAt: firebase.firestore.FieldValue.serverTimestamp(),
                resetAt: firebase.firestore.FieldValue.serverTimestamp()
            });
        });

        await batch.commit();

        alert(currentLanguage === 'ar'
            ? `تم إعادة تعيين درجات لـ ${membersSnapshot.size} عضو بنجاح`
            : `Successfully reset scores for ${membersSnapshot.size} members`);

        // Reload admin view to reflect changes
        loadAllTeamsForAdmin();

    } catch (error) {
        console.error('Error resetting scores:', error);
        alert(currentLanguage === 'ar' ? 'خطأ في إعادة تعيين الدرجات' : 'Error resetting scores');
    } finally {
        if (resetButton) {
            resetButton.disabled = false;
            resetButton.innerHTML = currentLanguage === 'ar' ? '🔄 إعادة تعيين جميع الدرجات' : '🔄 Reset All Scores';
        }
    }
}
// Reset Specific Team Scores Function (bonus feature)
async function resetTeamScores(teamCode, teamName) {
    const confirmMessage = currentLanguage === 'ar'
        ? `هل أنت متأكد من إعادة تعيين درجات  لفريق "${teamName}"؟`
        : `Are you sure you want to reset scores for team "${teamName}"?`;

    if (!confirm(confirmMessage)) return;

    try {
        const membersSnapshot = await db.collection('teamMembers')
            .where('teamCode', '==', teamCode)
            .get();

        if (membersSnapshot.empty) {
            alert(currentLanguage === 'ar' ? 'لا توجد أعضاء في هذا الفريق' : 'No members in this team');
            return;
        }

        const batch = db.batch();
        const resetScores = {
            securedLoan: 0,
            securedCreditCard: 0,
            unsecuredLoan: 0,
            unsecuredCreditCard: 0,
            bancassurance: 0
        };

        membersSnapshot.forEach(doc => {
            batch.update(doc.ref, {
                scores: resetScores,
                reviewedAt: firebase.firestore.FieldValue.serverTimestamp(),
                teamResetAt: firebase.firestore.FieldValue.serverTimestamp()
            });
        });

        await batch.commit();

        alert(currentLanguage === 'ar'
            ? `تم إعادة تعيين درجات فريق "${teamName}" بنجاح`
            : `Successfully reset scores for team "${teamName}"`);

        loadAllTeamsForAdmin();

    } catch (error) {
        console.error('Error resetting team scores:', error);
        alert(currentLanguage === 'ar' ? 'خطأ في إعادة تعيين درجات الفريق' : 'Error resetting team scores');
    }
}