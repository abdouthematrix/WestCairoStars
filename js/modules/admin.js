//==========================Admin Module - Subcollection Structure==================================//

const AdminModule = {
    // Current review date - defaults to today
    currentReviewDate: null,

    // Cache for performance optimization
    teamsCache: null,
    membersCache: new Map(), // teamId -> members array
    scoresCache: new Map(),  // "teamId-date" -> scores data

    // Initialize the admin module
    init() {
        this.currentReviewDate = window.appUtils.getTodayString();
        this.updateDateDisplay();
        this.clearAllCaches();
    },

    // Cache management
    clearAllCaches() {
        this.teamsCache = null;
        this.membersCache.clear();
        this.scoresCache.clear();
    },

    clearTeamCache(teamId) {
        this.membersCache.delete(teamId);
        // Clear score caches for this team
        for (const [key] of this.scoresCache) {
            if (key.startsWith(teamId + '-')) {
                this.scoresCache.delete(key);
            }
        }
    },

    // Date filtering functions
    setReviewDate(dateType) {
        const currentLanguage = window.appUtils.currentLanguage();

        // Remove active class from all buttons
        document.querySelectorAll('.date-filter-buttons .filter-btn').forEach(btn => {
            btn.classList.remove('active');
        });

        // Hide custom date picker
        document.getElementById('admin-date-picker').classList.add('hidden');

        let newDate;
        let displayText;

        switch (dateType) {
            case 'today':
                newDate = window.appUtils.getTodayString();
                displayText = currentLanguage === 'ar' ? 'اليوم' : 'Today';
                document.getElementById('admin-filter-today').classList.add('active');
                break;

            case 'yesterday':
                const yesterday = new Date();
                yesterday.setDate(yesterday.getDate() - 1);
                newDate = yesterday.toISOString().split('T')[0];
                displayText = currentLanguage === 'ar' ? 'أمس' : 'Yesterday';
                document.getElementById('admin-filter-yesterday').classList.add('active');
                break;

            case 'custom':
                document.getElementById('admin-filter-custom').classList.add('active');
                document.getElementById('admin-date-picker').classList.remove('hidden');
                document.getElementById('admin-custom-date').value = window.appUtils.getTodayString();
                return; // Don't reload yet, wait for user to select date
        }

        if (newDate) {
            this.currentReviewDate = newDate;
            this.updateDateDisplay(displayText);
            this.clearAllCaches(); // Clear cache when date changes
            this.loadAllTeamsForAdmin();
        }
    },

    applyCustomDate() {
        const customDate = document.getElementById('admin-custom-date').value;
        if (!customDate) return;

        this.currentReviewDate = customDate;

        // Format date for display
        const dateObj = new Date(customDate + 'T00:00:00');
        const displayText = dateObj.toLocaleDateString(
            window.appUtils.currentLanguage() === 'ar' ? 'ar-EG' : 'en-US',
            { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }
        );

        this.updateDateDisplay(displayText);
        this.clearAllCaches();
        this.loadAllTeamsForAdmin();
    },

    updateDateDisplay(customText = null) {
        const currentLanguage = window.appUtils.currentLanguage();
        const displayElement = document.getElementById('admin-selected-date-text');

        if (customText) {
            displayElement.textContent = customText;
        } else {
            displayElement.textContent = currentLanguage === 'ar' ? 'اليوم' : 'Today';
        }
    },

    // Get formatted date string for current review date
    getReviewDateString() {
        return this.currentReviewDate || window.appUtils.getTodayString();
    },

    // Check if current review date is today or yesterday
    isReviewingTodayOrYesterday() {
        return this.getReviewDateString() === window.appUtils.getTodayString() ||
            this.getReviewDateString() === window.appUtils.getYesterdayString();
    },

    // Load all teams with caching
    async loadTeams() {
        if (this.teamsCache) {
            return this.teamsCache;
        }

        const { db } = window.appUtils;

        try {
            // Load admin and regular teams in parallel
            const [adminTeamsSnapshot, regularTeamsSnapshot] = await Promise.all([
                db.collection('teams').where('isAdmin', '==', true).get(),
                db.collection('teams').where('isAdmin', '==', false).get()
            ]);

            this.teamsCache = {
                admin: adminTeamsSnapshot.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data()
                })),
                regular: regularTeamsSnapshot.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data()
                }))
            };

            return this.teamsCache;
        } catch (error) {
            console.error('Error loading teams:', error);
            throw error;
        }
    },

    // Load team members with caching
    async loadTeamMembers(teamId) {
        if (this.membersCache.has(teamId)) {
            return this.membersCache.get(teamId);
        }

        const { db } = window.appUtils;

        try {
            const membersSnapshot = await db.collection('teamMembers')
                .where('teamCode', '==', teamId)
                .get();

            const members = membersSnapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));

            this.membersCache.set(teamId, members);
            return members;
        } catch (error) {
            console.error('Error loading team members:', error);
            return [];
        }
    },

    // Load scores for specific date and team using subcollection structure
    async loadTeamScores(teamId, date) {
        const cacheKey = `${teamId}-${date}`;

        if (this.scoresCache.has(cacheKey)) {
            return this.scoresCache.get(cacheKey);
        }

        const { db } = window.appUtils;

        try {
            // Query subcollection: scores/{date}/{teamId}/
            const scoresSnapshot = await db.collection('scores')
                .doc(date)
                .collection(teamId)
                .get();

            const scoresMap = {};
            scoresSnapshot.forEach(doc => {
                scoresMap[doc.id] = doc.data();
            });

            this.scoresCache.set(cacheKey, scoresMap);
            return scoresMap;
        } catch (error) {
            console.error('Error loading team scores:', error);
            return {};
        }
    },

    // Main function to load all teams for admin interface
    async loadAllTeamsForAdmin() {
        const container = document.getElementById('admin-teams-container');
        if (!container) return;

        container.innerHTML = '<div class="loading"><div class="spinner"></div></div>';

        const currentLanguage = window.appUtils.currentLanguage();
        const reviewDate = this.getReviewDateString();
        const isTodayOrYesterday = this.isReviewingTodayOrYesterday();

        try {
            // Load all teams
            const teams = await this.loadTeams();

            // Build header HTML
            let html = `
                <div class="admin-header">
                    <h2 data-en="Team Management" data-ar="إدارة الفرق">إدارة الفرق</h2>
                    <div class="admin-header-actions">
                        <span class="date-context-indicator">
                            ${isTodayOrYesterday ?
                    (currentLanguage === 'ar' ? 'مراجعة اليوم' : 'Today\'s Review') :
                    (currentLanguage === 'ar' ? 'مراجعة تاريخية' : 'Historical Review')
                }
                        </span>
                        <button class="btn btn-primary" onclick="createNewTeam()" data-en="+ Create New Team" data-ar="+ إنشاء فريق جديد">+ إنشاء فريق جديد</button>
                        ${isTodayOrYesterday ? `
                            <button id="resetAllScoresBtn" class="btn btn-danger" onclick="resetAllScores()" data-en="🔄 Reset All Scores" data-ar="🔄 إعادة تعيين جميع الدرجات">🔄 إعادة تعيين جميع الدرجات</button>
                        ` : ''}
                    </div>
                </div>
            `;

            // Render admin teams first
            for (const team of teams.admin) {
                html += await this.renderTeamSection(team, true, reviewDate, isTodayOrYesterday);
            }

            // Then render regular teams
            for (const team of teams.regular) {
                html += await this.renderTeamSection(team, false, reviewDate, isTodayOrYesterday);
            }

            container.innerHTML = html;

            // Update language for new elements
            this.updateLanguageElements();

        } catch (error) {
            console.error('Error loading teams for admin:', error);
            container.innerHTML = `<p style="color:var(--danger-color);">${currentLanguage === 'ar' ? 'حدث خطأ أثناء تحميل الفرق' : 'Error loading teams'}</p>`;
        }
    },

    // Render individual team section
    async renderTeamSection(team, isAdminTeam, reviewDate, isTodayOrYesterday) {
        const teamId = team.id;

        // Load team members and scores in parallel
        const [members, scores] = await Promise.all([
            this.loadTeamMembers(teamId),
            this.loadTeamScores(teamId, reviewDate)
        ]);

        const memberRows = this.renderMemberRows(members, scores, teamId, isAdminTeam, isTodayOrYesterday);
        const contextClass = isTodayOrYesterday ? 'today-scores' : 'historical-scores';

        return `
            <div class="admin-section ${isAdminTeam ? 'admin-team-section' : ''} ${contextClass}">
                <div class="team-header">
                    <div class="team-info">
                        <h3>${team.name || teamId} ${isAdminTeam ? '<span class="admin-badge" data-en="ADMIN" data-ar="إدارة">إدارة</span>' : ''}</h3>
                        <p class="team-code">Code: ${teamId}</p>
                        ${!isAdminTeam && team.leader ? `<p class="team-leader">Leader: ${team.leader}</p>` : ''}
                    </div>
                    <div class="team-actions">
                        ${!isAdminTeam ? `
                            <button class="edit-btn btn-small" onclick="editTeamInfo('${teamId}', '${team.name}', '${team.leader || ''}')" data-en="Edit Team" data-ar="تعديل الفريق">تعديل الفريق</button>
                            <button class="edit-btn btn-small" onclick="editTeamLeader('${teamId}', '${team.leader || ''}')" data-en="Edit Leader" data-ar="تعديل القائد">تعديل القائد</button>
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
                            ${isTodayOrYesterday ? `
                                <button class="btn btn-warning btn-small" onclick="resetTeamScores('${teamId}', '${team.name}')" data-en="🔄 Reset Team" data-ar="🔄 إعادة تعيين الفريق">🔄 إعادة تعيين الفريق</button>
                            ` : ''}
                        ` : ''}
                    </div>
                    
                    <table class="members-table">
                        <thead>
                            <tr>
                                <th data-en="Picture" data-ar="الصورة">الصورة</th>
                                <th data-en="Name" data-ar="الاسم">الاسم</th>
                                <th data-en="Unavailable" data-ar="غير متوفر">غير متوفر</th>
                                <th data-en="Secured Loan" data-ar="قرض بضمان">قرض بضمان</th>
                                <th data-en="Secured Credit Card" data-ar="بطاقة ائتمان بضمان">بطاقة ائتمان بضمان</th>
                                <th data-en="Unsecured Loan" data-ar="قرض بدون ضمان">قرض بدون ضمان</th>
                                <th data-en="Unsecured Credit Card" data-ar="بطاقة ائتمان بدون ضمان">بطاقة ائتمان بدون ضمان</th>
                                <th data-en="Bancassurance" data-ar="التأمين البنكي">التأمين البنكي</th>
                                <th data-en="Total" data-ar="المجموع">المجموع</th>
                                <th data-en="Actions" data-ar="الإجراءات">الإجراءات</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${memberRows}
                            ${isAdminTeam && members.length === 0 ? `
                                <tr><td colspan="10" class="no-members" data-en="Admin team - No members required" data-ar="فريق الإدارة - لا يتطلب أعضاء">فريق الإدارة - لا يتطلب أعضاء</td></tr>
                            ` : ''}
                        </tbody>
                    </table>
                </div>
            </div>
        `;
    },

    // Render member rows for the team table
    renderMemberRows(members, scores, teamId, isAdminTeam, isTodayOrYesterday) {
        const { products } = window.appUtils;
        const currentLanguage = window.appUtils.currentLanguage();

        return members.map(member => {
            const memberId = member.id;
            const memberScores = scores[memberId] || {};
            const reviewedScores = memberScores.reviewedScores || {};
            const originalScores = memberScores.scores || {};
            const isUnavailable = memberScores.unavailable || false;
            
            // Calculate total from reviewed scores
            const total = Object.values(reviewedScores).reduce((sum, score) => {
                return sum + (parseInt(score) || 0);
            }, 0);

            // Add unavailable styling class
            const unavailableClass = isUnavailable ? 'member-unavailable' : '';

            return `
            <tr id="admin-member-row-${memberId}" class="member-row ${isAdminTeam ? 'admin-team-row' : ''} ${unavailableClass}">
                <td class="member-photo">
                    ${member.teamMemberImage ?
                    `<img src="${member.teamMemberImage}" alt="${member.name}" style="width: 50px; height: 50px; border-radius: 50%; object-fit: cover;">` :
                    `<div style="width: 50px; height: 50px; border-radius: 50%; background: #e5e7eb; display: flex; align-items: center; justify-content: center; font-size: 12px; color: #6b7280;">${currentLanguage === 'ar' ? 'لا توجد صورة' : 'No Photo'}</div>`
                }
                    ${!isAdminTeam ? `
                        <button class="upload-image-btn" onclick="uploadMemberImageAdmin('${memberId}')" style="margin-top: 5px; padding: 2px 8px; font-size: 10px;">
                            ${currentLanguage === 'ar' ? 'رفع صورة' : 'Upload'}
                        </button>
                    ` : ''}
                </td>
                <td>${member.name}</td>
                <td class="unavailable-cell">
                    <input type="checkbox" 
                           class="unavailable-checkbox" 
                           ${isUnavailable ? 'checked' : ''}
                           id="unavailable-${memberId}"
                           ${isAdminTeam || !isTodayOrYesterday ? 'disabled' : ''}
                           ${isTodayOrYesterday && !isAdminTeam ? `onchange="autoSaveUnavailable('${teamId}','${memberId}', this.checked)"` : ''}>
                </td>
                ${products.map(product => `
                    <td>
                        <input type="number" 
                               min="0" 
                               class="score-input" 
                               value="${reviewedScores[product] || ''}" 
                               id="reviewed-${memberId}-${product}"
                               ${isAdminTeam || !isTodayOrYesterday || isUnavailable ? 'disabled' : ''}
                               ${isTodayOrYesterday && !isAdminTeam ? `onchange="autoSaveScore('${teamId}','${memberId}', '${product}', this.value)"` : ''}>
                        <div class="original-score" style="font-size: 0.8em; color: #059669; margin-top: 2px;">
                            Original: ${originalScores[product] || '0'}
                        </div>   
                    </td>
                `).join('')}
                <td><strong>${isUnavailable ? 'N/A' : total}</strong></td>
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
        }).join('');
    },

    // Auto-save unavailable status using subcollection structure
    async autoSaveUnavailable(teamId, memberId, isUnavailable) {
        if (!this.isReviewingTodayOrYesterday()) {
            alert(window.appUtils.currentLanguage() === 'ar' ?
                'يمكن تعديل درجات اليوم او امس فقط' :
                'Can only edit today\'s or yesterday\'s scores');
            return;
        }

        const { db } = window.appUtils;
        const reviewDate = this.getReviewDateString();

        try {
            // Save to subcollection: scores/{date}/{teamId}/{memberId}
            const memberScoreRef = db.collection('scores')
                .doc(reviewDate)
                .collection(teamId)
                .doc(memberId);

            // Get current data or create new structure
            const currentDoc = await memberScoreRef.get();
            const currentData = currentDoc.exists ? currentDoc.data() : {
                reviewedScores: {},
                scores: {},
                unavailable: false,
                lastUpdated: firebase.firestore.FieldValue.serverTimestamp()
            };

            // Update the unavailable status
            currentData.unavailable = isUnavailable;
            currentData.lastUpdated = firebase.firestore.FieldValue.serverTimestamp();

            // Save to database
            await memberScoreRef.set(currentData, { merge: true });

            // Update cache
            const cacheKey = `${teamId}-${reviewDate}`;
            if (this.scoresCache.has(cacheKey)) {
                const cachedScores = this.scoresCache.get(cacheKey);
                if (!cachedScores[memberId]) {
                    cachedScores[memberId] = { reviewedScores: {}, scores: {}, unavailable: false };
                }
                cachedScores[memberId].unavailable = isUnavailable;
            }

            // Update UI
            this.updateMemberRowUnavailableStatus(memberId, isUnavailable);

            // Visual feedback
            this.showSaveSuccess(memberId);

        } catch (error) {
            console.error('Error auto-saving unavailable status:', error);
            alert(window.appUtils.currentLanguage() === 'ar' ?
                'خطأ في حفظ حالة التوفر' : 'Error saving availability status');
        }
    },

    // Update member row unavailable status
    updateMemberRowUnavailableStatus(memberId, isUnavailable) {
        const row = document.getElementById(`admin-member-row-${memberId}`);
        if (!row) return;

        // Toggle unavailable class
        if (isUnavailable) {
            row.classList.add('member-unavailable');
        } else {
            row.classList.remove('member-unavailable');
        }

        // Disable/enable score inputs
        const scoreInputs = row.querySelectorAll('.score-input');
        scoreInputs.forEach(input => {
            input.disabled = isUnavailable;
        });

        // Update total display
        const totalCell = row.querySelector('td:nth-last-child(2) strong');
        if (totalCell) {
            if (isUnavailable) {
                totalCell.textContent = 'N/A';
            } else {
                this.updateMemberRowTotal(memberId);
            }
        }
    },

    // Auto-save score function using subcollection structure
    async autoSaveScore(teamId, memberId, product, score) {
        if (!this.isReviewingTodayOrYesterday()) {
            alert(window.appUtils.currentLanguage() === 'ar' ?
                'يمكن تعديل درجات اليوم او امس فقط' :
                'Can only edit today\'s or yesterday\'s scores');
            return;
        }

        const { db } = window.appUtils;
        const reviewDate = this.getReviewDateString();

        try {
            const numScore = parseInt(score) || 0;

            // Save to subcollection: scores/{date}/{teamId}/{memberId}
            const memberScoreRef = db.collection('scores')
                .doc(reviewDate)
                .collection(teamId)
                .doc(memberId);

            // Get current data or create new structure
            const currentDoc = await memberScoreRef.get();
            const currentData = currentDoc.exists ? currentDoc.data() : {
                reviewedScores: {},
                scores: {},
                unavailable: false,
                lastUpdated: firebase.firestore.FieldValue.serverTimestamp()
            };
            currentData.reviewedScores = currentData.reviewedScores || {};

            // Update the specific product score
            currentData.reviewedScores[product] = numScore;
            currentData.lastUpdated = firebase.firestore.FieldValue.serverTimestamp();

            // Save to database
            await memberScoreRef.set(currentData, { merge: true });

            // Update cache
            const cacheKey = `${teamId}-${reviewDate}`;
            if (this.scoresCache.has(cacheKey)) {
                const cachedScores = this.scoresCache.get(cacheKey);
                if (!cachedScores[memberId]) {
                    cachedScores[memberId] = { reviewedScores: {}, scores: {}, unavailable: false };
                }
                cachedScores[memberId].reviewedScores = currentData.reviewedScores || {};
                cachedScores[memberId].reviewedScores[product] = numScore;
            }

            // Update UI total
            this.updateMemberRowTotal(memberId);

            // Visual feedback
            this.showSaveSuccess(memberId);

        } catch (error) {
            console.error('Error auto-saving score:', error);
            alert(window.appUtils.currentLanguage() === 'ar' ?
                'خطأ في حفظ الدرجة' : 'Error saving score');
        }
    },

    // Update member row total display
    updateMemberRowTotal(memberId) {
        const { products } = window.appUtils;
        const row = document.getElementById(`admin-member-row-${memberId}`);
        if (!row) return;

        const totalCell = row.querySelector('td:nth-last-child(2) strong');
        if (totalCell) {
            // Check if member is unavailable
            const unavailableCheckbox = document.getElementById(`unavailable-${memberId}`);
            if (unavailableCheckbox && unavailableCheckbox.checked) {
                totalCell.textContent = 'N/A';
                return;
            }

            let newTotal = 0;
            products.forEach(product => {
                const input = document.getElementById(`reviewed-${memberId}-${product}`);
                if (input && input.value) {
                    newTotal += parseInt(input.value) || 0;
                }
            });
            totalCell.textContent = newTotal;
        }
    },

    // Show visual feedback for successful save
    showSaveSuccess(memberId) {
        const row = document.getElementById(`admin-member-row-${memberId}`);
        if (row) {
            row.style.background = '#d1fae5';
            setTimeout(() => {
                row.style.background = '';
            }, 1000);
        }
    },

    // Update language elements
    updateLanguageElements() {
        const currentLanguage = window.appUtils.currentLanguage();
        document.querySelectorAll('[data-en][data-ar]').forEach(element => {
            element.textContent = element.getAttribute(`data-${currentLanguage}`);
        });
    },

    // Team Management Functions
    async createNewTeam() {
        const currentLanguage = window.appUtils.currentLanguage();
        const { db } = window.appUtils;

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

            // Clear cache and reload
            this.clearAllCaches();
            await this.loadAllTeamsForAdmin();
        } catch (error) {
            console.error('Error creating team:', error);
            alert(currentLanguage === 'ar' ? 'خطأ في إنشاء الفريق' : 'Error creating team');
        }
    },

    async deleteTeam(teamId, teamName) {
        const currentLanguage = window.appUtils.currentLanguage();
        const { db } = window.appUtils;

        try {
            // Check if this is an admin team
            const teamDoc = await db.collection('teams').doc(teamId).get();
            if (teamDoc.exists && teamDoc.data().isAdmin) {
                alert(currentLanguage === 'ar' ? 'لا يمكن حذف فريق الإدارة' : 'Cannot delete admin team');
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

            // Clear cache and reload
            this.clearAllCaches();
            await this.loadAllTeamsForAdmin();
        } catch (error) {
            console.error('Error deleting team:', error);
            alert(currentLanguage === 'ar' ? 'خطأ في حذف الفريق' : 'Error deleting team');
        }
    },

    async editTeamInfo(teamId, currentName, currentLeader) {
        const currentLanguage = window.appUtils.currentLanguage();
        const { db } = window.appUtils;

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

            // Clear cache and reload
            this.clearAllCaches();
            await this.loadAllTeamsForAdmin();
        } catch (error) {
            console.error('Error updating team name:', error);
            alert(currentLanguage === 'ar' ? 'خطأ في تحديث اسم الفريق' : 'Error updating team name');
        }
    },

    async editTeamLeader(teamId, currentLeader) {
        const currentLanguage = window.appUtils.currentLanguage();
        const { db } = window.appUtils;

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

            // Clear cache and reload
            this.clearAllCaches();
            await this.loadAllTeamsForAdmin();
        } catch (error) {
            console.error('Error updating team leader:', error);
            alert(currentLanguage === 'ar' ? 'خطأ في تحديث قائد الفريق' : 'Error updating team leader');
        }
    },

    // Member Management Functions
    async addMemberToTeam(teamCode) {
        const currentLanguage = window.appUtils.currentLanguage();
        const { db } = window.appUtils;

        const memberName = prompt(currentLanguage === 'ar' ? 'اسم العضو الجديد:' : 'New member name:');
        if (!memberName || !memberName.trim()) return;

        try {
            const newMember = {
                name: memberName.trim(),
                teamCode: teamCode,
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            };

            await db.collection('teamMembers').add(newMember);
            alert(currentLanguage === 'ar' ? 'تم إضافة العضو بنجاح' : 'Member added successfully');

            // Clear specific team cache and reload
            this.clearTeamCache(teamCode);
            await this.loadAllTeamsForAdmin();
        } catch (error) {
            console.error('Error adding member:', error);
            alert(currentLanguage === 'ar' ? 'خطأ في إضافة العضو' : 'Error adding member');
        }
    },

    async editMemberName(memberId, currentName) {
        const currentLanguage = window.appUtils.currentLanguage();
        const { db } = window.appUtils;

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

            // Clear cache and reload
            this.clearAllCaches();
            await this.loadAllTeamsForAdmin();
        } catch (error) {
            console.error('Error updating member name:', error);
            alert(currentLanguage === 'ar' ? 'خطأ في تحديث اسم العضو' : 'Error updating member name');
        }
    },

    async removeMemberFromTeam(memberId, memberName) {
        const currentLanguage = window.appUtils.currentLanguage();
        const { db } = window.appUtils;

        if (!confirm(
            currentLanguage === 'ar'
                ? `هل أنت متأكد من حذف العضو "${memberName}"؟`
                : `Are you sure you want to remove member "${memberName}"?`
        )) return;

        try {
            await db.collection('teamMembers').doc(memberId).delete();
            alert(currentLanguage === 'ar' ? 'تم حذف العضو بنجاح' : 'Member removed successfully');

            // Clear cache and reload
            this.clearAllCaches();
            await this.loadAllTeamsForAdmin();
        } catch (error) {
            console.error('Error removing member:', error);
            alert(currentLanguage === 'ar' ? 'خطأ في حذف العضو' : 'Error removing member');
        }
    },

    async changeTeamCode(oldTeamId, teamName) {
        const currentLanguage = window.appUtils.currentLanguage();
        const { db } = window.appUtils;

        try {
            // Check if this is an admin team
            const teamDoc = await db.collection('teams').doc(oldTeamId).get();
            if (teamDoc.exists && teamDoc.data().isAdmin) {
                alert(currentLanguage === 'ar' ? 'لا يمكن تغيير رمز فريق الإدارة' : 'Cannot change admin team code');
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

            // Clear cache and reload
            this.clearAllCaches();
            await this.loadAllTeamsForAdmin();
        } catch (error) {
            console.error('Error changing team code:', error);
            alert(currentLanguage === 'ar' ? 'خطأ في تغيير رمز الفريق' : 'Error changing team code');
        }
    },

    // Reset Functions using subcollection structure
    async resetAllScores() {
        const currentLanguage = window.appUtils.currentLanguage();
        const { db } = window.appUtils;
        const today = window.appUtils.getTodayString();

        const confirmMessage = currentLanguage === 'ar'
            ? 'هل أنت متأكد من إعادة تعيين جميع درجات جميع أعضاء الفرق؟ هذا الإجراء لا يمكن التراجع عنه!'
            : 'Are you sure you want to reset all scores for all team members? This action cannot be undone!';

        if (!confirm(confirmMessage)) return;

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
            // Get all non-admin teams
            const teamsSnapshot = await db.collection('teams')
                .where('isAdmin', '==', false)
                .get();

            if (teamsSnapshot.empty) {
                alert(currentLanguage === 'ar' ? 'لا توجد بيانات للإعادة تعيين' : 'No data to reset');
                return;
            }

            let totalResetCount = 0;

            // Reset scores for each team using subcollection structure
            for (const teamDoc of teamsSnapshot.docs) {
                const teamId = teamDoc.id;

                // Get all scores for this team today using subcollection
                const scoresSnapshot = await db.collection('scores')
                    .doc(today)
                    .collection(teamId)
                    .get();

                if (!scoresSnapshot.empty) {
                    const batch = db.batch();
                    const resetScores = {
                        securedLoan: 0,
                        securedCreditCard: 0,
                        unsecuredLoan: 0,
                        unsecuredCreditCard: 0,
                        bancassurance: 0
                    };

                    scoresSnapshot.forEach(scoreDoc => {
                        // Reset scores but keep unavailable status
                        batch.update(scoreDoc.ref, {
                            scores: resetScores,
                            reviewedScores: resetScores,
                            resetAt: firebase.firestore.FieldValue.serverTimestamp(),
                            lastUpdated: firebase.firestore.FieldValue.serverTimestamp()
                        });
                    });

                    await batch.commit();
                    totalResetCount += scoresSnapshot.size;
                }
            }

            alert(currentLanguage === 'ar'
                ? `تم إعادة تعيين درجات لـ ${totalResetCount} عضو بنجاح`
                : `Successfully reset scores for ${totalResetCount} members`);

            // Clear cache and reload
            this.clearAllCaches();
            await this.loadAllTeamsForAdmin();

        } catch (error) {
            console.error('Error resetting all scores:', error);
            alert(currentLanguage === 'ar' ? 'خطأ في إعادة تعيين الدرجات' : 'Error resetting scores');
        } finally {
            if (resetButton) {
                resetButton.disabled = false;
                resetButton.innerHTML = currentLanguage === 'ar' ? '🔄 إعادة تعيين جميع الدرجات' : '🔄 Reset All Scores';
            }
        }
    },

    async resetTeamScores(teamCode, teamName) {
        const currentLanguage = window.appUtils.currentLanguage();
        const { db } = window.appUtils;
        const today = window.appUtils.getTodayString();

        const confirmMessage = currentLanguage === 'ar'
            ? `هل أنت متأكد من إعادة تعيين درجات لفريق "${teamName}"؟`
            : `Are you sure you want to reset scores for team "${teamName}"?`;

        if (!confirm(confirmMessage)) return;

        try {
            // Get all scores for this team today using subcollection
            const scoresSnapshot = await db.collection('scores')
                .doc(today)
                .collection(teamCode)
                .get();

            if (scoresSnapshot.empty) {
                alert(currentLanguage === 'ar' ? 'لا توجد درجات لإعادة تعيينها' : 'No scores to reset');
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

            scoresSnapshot.forEach(scoreDoc => {
                batch.update(scoreDoc.ref, {
                    scores: resetScores,
                    reviewedScores: resetScores,
                    teamResetAt: firebase.firestore.FieldValue.serverTimestamp(),
                    lastUpdated: firebase.firestore.FieldValue.serverTimestamp()
                });
            });

            await batch.commit();

            alert(currentLanguage === 'ar'
                ? `تم إعادة تعيين درجات فريق "${teamName}" بنجاح`
                : `Successfully reset scores for team "${teamName}"`);

            // Clear specific team cache and reload
            this.scoresCache.delete(`${teamCode}-${today}`);
            await this.loadAllTeamsForAdmin();

        } catch (error) {
            console.error('Error resetting team scores:', error);
            alert(currentLanguage === 'ar' ? 'خطأ في إعادة تعيين درجات الفريق' : 'Error resetting team scores');
        }
    },

    // Upload member image function for admin
    async uploadMemberImageAdmin(memberId) {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'image/*';

        input.onchange = async (e) => {
            const file = e.target.files[0];
            if (!file) return;

            // Check file size (limit to 2MB)
            if (file.size > 2 * 1024 * 1024) {
                const currentLanguage = window.appUtils.currentLanguage();
                alert(currentLanguage === 'ar' ? 'حجم الصورة كبير جداً (الحد الأقصى 2MB)' : 'Image size too large (max 2MB)');
                return;
            }

            try {
                window.appUtils.showLoadingIndicator();

                const reader = new FileReader();
                reader.onload = async () => {
                    try {
                        const base64 = reader.result;
                        await this.saveMemberImageAdmin(memberId, base64);
                    } catch (error) {
                        console.error('Error saving image:', error);
                        const currentLanguage = window.appUtils.currentLanguage();
                        alert(currentLanguage === 'ar' ? 'خطأ في حفظ الصورة' : 'Error saving image');
                    }
                };
                reader.readAsDataURL(file);

            } catch (error) {
                console.error('Error uploading image:', error);
                const currentLanguage = window.appUtils.currentLanguage();
                alert(currentLanguage === 'ar' ? 'خطأ في رفع الصورة' : 'Error uploading image');
            } finally {
                window.appUtils.hideLoadingIndicator();
            }
        };

        input.click();
    },

    // Save member image to Firestore
    async saveMemberImageAdmin(memberId, base64Image) {
        const { db } = window.appUtils;

        try {
            await db.collection('teamMembers').doc(memberId).update({
                teamMemberImage: base64Image,
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            });

            await this.loadAllTeamsForAdmin();

            const currentLanguage = window.appUtils.currentLanguage();
            alert(currentLanguage === 'ar' ? 'تم حفظ الصورة بنجاح' : 'Image saved successfully');

        } catch (error) {
            console.error('Error saving member image:', error);
            throw error;
        }
    }
};

// Register module globally
window.modules = window.modules || {};
window.modules.admin = AdminModule;

// Make functions globally accessible
window.uploadMemberImageAdmin = AdminModule.uploadMemberImageAdmin.bind(AdminModule);
window.saveMemberImageAdmin = AdminModule.saveMemberImageAdmin.bind(AdminModule);
window.autoSaveUnavailable = AdminModule.autoSaveUnavailable.bind(AdminModule);

// Make functions globally accessible for HTML onclick handlers
window.createNewTeam = AdminModule.createNewTeam.bind(AdminModule);
window.deleteTeam = AdminModule.deleteTeam.bind(AdminModule);
window.editTeamInfo = AdminModule.editTeamInfo.bind(AdminModule);
window.editTeamLeader = AdminModule.editTeamLeader.bind(AdminModule);
window.addMemberToTeam = AdminModule.addMemberToTeam.bind(AdminModule);
window.editMemberName = AdminModule.editMemberName.bind(AdminModule);
window.removeMemberFromTeam = AdminModule.removeMemberFromTeam.bind(AdminModule);
window.autoSaveScore = AdminModule.autoSaveScore.bind(AdminModule);
window.changeTeamCode = AdminModule.changeTeamCode.bind(AdminModule);
window.resetAllScores = AdminModule.resetAllScores.bind(AdminModule);
window.resetTeamScores = AdminModule.resetTeamScores.bind(AdminModule);

export default AdminModule;