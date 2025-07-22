
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
        let currentUser = null;
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
            document.querySelector('.language-toggle').textContent = currentLanguage === 'ar' ? 'EN' : 'ع';
        }

        // Modal Functions
        function openLoginModal() {
            document.getElementById('loginModal').style.display = 'block';
        }

        function closeLoginModal() {
            document.getElementById('loginModal').style.display = 'none';
        }

        // Login Handler
        async function handleLogin(event) {
            event.preventDefault();
            const teamCode = document.getElementById('teamCode').value.trim();
            
            try {
                // Verify team code exists in database
                const teamDoc = await db.collection('teams').doc(teamCode).get();
                
                if (teamDoc.exists) {
                    currentTeamCode = teamCode;
                    currentUser = { teamCode }; // simulate login
                    
                    // Hide leaderboard, show dashboard
                    document.getElementById('leaderboard-view').style.display = 'none';
                    document.getElementById('dashboard').style.display = 'block';
                    document.getElementById('teamName').textContent = teamDoc.data().name || teamCode;
                    
                    closeLoginModal();
                    await loadTeamMembers();
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
            currentUser = null;
            currentTeamCode = null;
            document.getElementById('dashboard').style.display = 'none';
            document.getElementById('leaderboard-view').style.display = 'block';
            document.getElementById('teamCode').value = '';
        }

        // Load Team Members
        async function loadTeamMembers() {
            try {
                const membersSnapshot = await db.collection('teamMembers')
                    .where('teamCode', '==', currentTeamCode)
                    .get();
                
                teamMembers = [];
                membersSnapshot.forEach(doc => {
                    teamMembers.push({ id: doc.id, ...doc.data() });
                });
                
                renderMembersTable();
            } catch (error) {
                console.error('Error loading team members:', error);
            }
        }

        // Render Members Table
        function renderMembersTable() {
            const tbody = document.getElementById('membersTable');
            tbody.innerHTML = '';
            
            teamMembers.forEach(member => {
                const row = document.createElement('tr');
                const total = products.reduce((sum, product) => sum + (member.scores?.[product] || 0), 0);
                
                row.innerHTML = `
                    <td>${member.name}</td>
                    ${products.map(product => `
                        <td>
                            <input type="number" 
                                   class="score-input" 
                                   value="${member.scores?.[product] || 0}"
                                   onchange="updateMemberScore('${member.id}', '${product}', this.value)"
                                   min="0">
                        </td>
                    `).join('')}
                    <td><strong>${total}</strong></td>
                    <td class="action-btns">
                        <button class="edit-btn" onclick="editMember('${member.id}')">${currentLanguage === 'ar' ? 'تعديل' : 'Edit'}</button>
                        <button class="delete-btn" onclick="deleteMember('${member.id}')">${currentLanguage === 'ar' ? 'حذف' : 'Delete'}</button>
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
                    teamCode: currentTeamCode,// ensure it matches current session
                    scores: {
                        securedLoan: 0,
                        securedCreditCard: 0,
                        unsecuredLoan: 0,
                        unsecuredCreditCard: 0,
                        bancassurance: 0
                    },
                    createdAt: firebase.firestore.FieldValue.serverTimestamp()
                };
                
                const docRef = await db.collection('teamMembers').add(newMember);
                teamMembers.push({ id: docRef.id, ...newMember });
                renderMembersTable();
            } catch (error) {
                console.error('Error adding member:', error);
                alert(currentLanguage === 'ar' ? 'خطأ في إضافة العضو' : 'Error adding member');
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

        // Load Top Achievers
        async function loadTopAchievers() {
            try {
                const snapshot = await db.collection('teamMembers').get();
                const achievers = [];
                
                snapshot.forEach(doc => {
                    const data = doc.data();
                    const scores = data.scores || {};
                    const productsWithScore = products.filter(p => scores[p] > 0).length;
                    
                    if (productsWithScore >= 2) {
                        const totalScore = products.reduce((sum, p) => sum + (scores[p] || 0), 0);
                        achievers.push({
                            name: data.name,
                            score: totalScore
                        });
                    }
                });
                
                achievers.sort((a, b) => b.score - a.score);
                renderLeaderboard('top-achievers', achievers.slice(0, 10));
            } catch (error) {
                console.error('Error loading top achievers:', error);
            }
        }

        // Load Top Teams
        async function loadTopTeams() {
            try {
                const teamsSnapshot = await db.collection('teams').get();
                const teams = [];
                
                for (const teamDoc of teamsSnapshot.docs) {
                    const teamData = teamDoc.data();
                    const membersSnapshot = await db.collection('teamMembers')
                        .where('teamCode', '==', teamDoc.id)
                        .get();
                    
                    let allMembersActive = true;
                    let totalScore = 0;
                    
                    membersSnapshot.forEach(memberDoc => {
                        const memberData = memberDoc.data();
                        const scores = memberData.scores || {};
                        const memberTotal = products.reduce((sum, p) => sum + (scores[p] || 0), 0);
                        
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

        // Load Top Team Leaders
        async function loadTopTeamLeaders() {
            try {
                const teamsSnapshot = await db.collection('teams').get();
                const leaders = [];

                for (const teamDoc of teamsSnapshot.docs) {
                    const teamData = teamDoc.data();
                    const membersSnapshot = await db.collection('teamMembers')
                        .where('teamCode', '==', teamDoc.id)
                        .get();

                    let allMembersActive = true;
                    let totalScore = 0;

                    membersSnapshot.forEach(memberDoc => {
                        const memberData = memberDoc.data();
                        const scores = memberData.scores || {};
                        const memberTotal = products.reduce((sum, p) => sum + (scores[p] || 0), 0);

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

        // Render Leaderboard
        function renderLeaderboard(containerId, data) {
            const container = document.getElementById(containerId);
            
            if (data.length === 0) {
                container.innerHTML = `<p style="text-align: center; color: var(--text-secondary); padding: 20px;">${
                    currentLanguage === 'ar' ? 'لا توجد بيانات' : 'No data available'
                }</p>`;
                return;
            }
            
            container.innerHTML = data.map((item, index) => {
                const trophy = index === 0 ? '🏆' : index === 1 ? '🥈' : index === 2 ? '🥉' : '';
                return `
                    <div class="leaderboard-item">
                        <span class="rank">#${index + 1}</span>
                        <span class="name">${item.name}${item.team ? ` (${item.team})` : ''}</span>
                        <span class="score">${item.score} <span class="trophy">${trophy}</span></span>
                    </div>
                `;
            }).join('');
        }
                               
        // Close modal when clicking outside
        window.onclick = function(event) {
            const modal = document.getElementById('loginModal');
            if (event.target === modal) {
                closeLoginModal();
            }
        }

        // Initialize the application
        document.addEventListener('DOMContentLoaded', function() {
            // Set initial language
            toggleLanguage();
            toggleLanguage(); // Call twice to set to Arabic by default
            
            loadLeaderboards();
            
            // Set up real-time listeners for leaderboard updates
            setInterval(loadLeaderboards, 30000); // Refresh every 30 seconds
        });

        // Admin Functions (for future implementation)
        const AdminFunctions = {
            // Review and update all team scores
            async reviewTeamScores() {
                try {
                    const teamsSnapshot = await db.collection('teams').get();
                    const reviewData = [];
                    
                    for (const teamDoc of teamsSnapshot.docs) {
                        const membersSnapshot = await db.collection('teamMembers')
                            .where('teamCode', '==', teamDoc.id)
                            .get();
                        
                        const teamData = {
                            teamId: teamDoc.id,
                            teamName: teamDoc.data().name,
                            members: []
                        };
                        
                        membersSnapshot.forEach(memberDoc => {
                            const memberData = memberDoc.data();
                            teamData.members.push({
                                id: memberDoc.id,
                                name: memberData.name,
                                scores: memberData.scores || {}
                            });
                        });
                        
                        reviewData.push(teamData);
                    }
                    
                    return reviewData;
                } catch (error) {
                    console.error('Error reviewing team scores:', error);
                    throw error;
                }
            },
            
            // Update achieved scores
            async updateAchievedScore(memberId, product, achievedScore) {
                try {
                    await db.collection('teamMembers').doc(memberId).update({
                        [`achievedScores.${product}`]: achievedScore,
                        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
                    });
                } catch (error) {
                    console.error('Error updating achieved score:', error);
                    throw error;
                }
            },
            
            // Get daily leaderboard
            async getDailyLeaderboard(date) {
                try {
                    const startDate = new Date(date);
                    startDate.setHours(0, 0, 0, 0);
                    const endDate = new Date(date);
                    endDate.setHours(23, 59, 59, 999);
                    
                    const snapshot = await db.collection('dailyScores')
                        .where('date', '>=', startDate)
                        .where('date', '<=', endDate)
                        .get();
                    
                    const leaderboard = [];
                    snapshot.forEach(doc => {
                        leaderboard.push(doc.data());
                    });
                    
                    return leaderboard.sort((a, b) => b.totalScore - a.totalScore);
                } catch (error) {
                    console.error('Error getting daily leaderboard:', error);
                    throw error;
                }
            }
        };

        // Export admin functions for console access
        window.AdminFunctions = AdminFunctions;