// Dashboard Module - Optimized for Subcollection Structure
// Firestore structure: scores/{date}/{teamId}/{memberId}

const DashboardModule = {
    // Cache for team members and scores
    teamMembersCache: null,
    currentScoresCache: null,

    // Load Team Members
    async loadTeamMembers(currentTeamCode, teamMembers) {
        const { db } = window.appUtils;

        try {
            window.appUtils.showLoadingIndicator();

            const membersSnapshot = await db.collection('teamMembers')
                .where('teamCode', '==', currentTeamCode)
                .get();

            const members = [];
            membersSnapshot.forEach(doc => {
                members.push({
                    id: doc.id,
                    ...doc.data()
                });
            });

            // Cache the members
            this.teamMembersCache = members;
            window.appUtils.setTeamMembers(members);

            await this.renderMembersTable();
        } catch (error) {
            console.error('Error loading team members:', error);
            window.appUtils.showErrorMessage('Error loading team members');
        } finally {
            window.appUtils.hideLoadingIndicator();
        }
    },

    // Load today's scores for current team using subcollection structure
    async loadTodayScores() {
        const { db } = window.appUtils;
        const currentTeamCode = window.appUtils.currentTeamCode();
        const today = window.appUtils.getTodayString();

        try {
            // Query the subcollection: scores/{today}/{teamCode}
            const scoresSnapshot = await db.collection('scores')
                .doc(today)
                .collection(currentTeamCode)
                .get();

            const scoresMap = {};
            scoresSnapshot.docs.forEach(doc => {
                scoresMap[doc.id] = doc.data();
            });

            this.currentScoresCache = scoresMap;
            return scoresMap;

        } catch (error) {
            console.error('Error loading today scores:', error);
            return {};
        }
    },

    // Save member score using subcollection structure
    async saveMemberScore(memberId, product, score) {
        const { db } = window.appUtils;
        const currentTeamCode = window.appUtils.currentTeamCode();
        const today = window.appUtils.getTodayString();

        try {
            // Reference to the member's score document in subcollection
            const memberScoreRef = db.collection('scores')
                .doc(today)
                .collection(currentTeamCode)
                .doc(memberId);

            // Get current scores or initialize empty
            const currentDoc = await memberScoreRef.get();
            const currentData = currentDoc.exists ? currentDoc.data() : {};
            const currentScores = currentData.scores || {};

            // Update the specific product score
            const updatedScores = {
                ...currentScores,
                [product]: score
            };

            // Save back to Firestore
            await memberScoreRef.set({
                scores: updatedScores,
                reviewedScores: currentData.reviewedScores || {},
                lastUpdated: firebase.firestore.FieldValue.serverTimestamp(),
                teamCode: currentTeamCode
            }, { merge: true });

            // Update cache
            if (!this.currentScoresCache[memberId]) {
                this.currentScoresCache[memberId] = { scores: {}, reviewedScores: {} };
            }
            this.currentScoresCache[memberId].scores = updatedScores;

            return true;

        } catch (error) {
            console.error('Error saving member score:', error);
            throw error;
        }
    },

    // Render Members Table with both scores and reviewed scores
    async renderMembersTable() {
        const tbody = document.getElementById('membersTable');
        if (!tbody) return;

        const teamMembers = this.teamMembersCache || window.appUtils.teamMembers();
        const currentLanguage = window.appUtils.currentLanguage();
        const { products } = window.appUtils;

        if (!teamMembers || teamMembers.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="${products.length + 3}" style="text-align: center; padding: 20px;">
                        ${currentLanguage === 'ar' ? 'لا توجد أعضاء' : 'No members found'}
                    </td>
                </tr>
            `;
            return;
        }

        tbody.innerHTML = '';

        // Load today's scores using the new method
        const dailyScoresMap = await this.loadTodayScores();

        teamMembers.forEach(member => {
            const data = dailyScoresMap[member.id] || { scores: {}, reviewedScores: {} };
            const row = document.createElement('tr');
            const regularScores = data.scores || {};
            const reviewedScores = data.reviewedScores || {};
            const effectiveScores = window.scoreUtils.getEffectiveScores(data);
            const total = window.scoreUtils.calculateTotalScore(data);

            // Check if reviewed scores exist
            const hasReviewedScores = Object.values(reviewedScores).some(score => score > 0);

            row.innerHTML = `
    <td class="member-photo">
        ${member.teamMemberImage ?
                    `<img src="${member.teamMemberImage}" alt="${member.name}" style="width: 50px; height: 50px; border-radius: 50%; object-fit: cover;">` :
                    `<div style="width: 50px; height: 50px; border-radius: 50%; background: #e5e7eb; display: flex; align-items: center; justify-content: center; font-size: 12px; color: #6b7280;">${currentLanguage === 'ar' ? 'لا توجد صورة' : 'No Photo'}</div>`
                }
        <button class="upload-image-btn" onclick="window.modules.dashboard.uploadAndSaveMemberImage('${member.id}')" style="margin-top: 5px; padding: 2px 8px; font-size: 10px;">
            ${currentLanguage === 'ar' ? 'رفع صورة' : 'Upload'}
        </button>
    </td>
                <td>${member.name}</td>
                ${products.map(product => {
                const regularScore = regularScores[product] || 0;
                const reviewedScore = reviewedScores[product] || 0;

                return `
                        <td>
                            <input type="number" 
                                   class="score-input" 
                                   value="${regularScore}"
                                   onchange="window.modules.dashboard.updateMemberScore('${member.id}', '${product}', this.value)"
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
                    <button data-en="Edit" data-ar="تعديل" class="edit-btn" onclick="window.modules.dashboard.editMember('${member.id}')">${currentLanguage === 'ar' ? 'تعديل' : 'Edit'}</button>
                    <button data-en="Delete" data-ar="حذف" class="delete-btn" onclick="window.modules.dashboard.deleteMember('${member.id}')">${currentLanguage === 'ar' ? 'حذف' : 'Delete'}</button>
                </td>
            `;
            tbody.appendChild(row);
        });
    },

    // Add Member
    async addMember() {
        const currentLanguage = window.appUtils.currentLanguage();
        const currentTeamCode = window.appUtils.currentTeamCode();
        const { db } = window.appUtils;

        const name = prompt(currentLanguage === 'ar' ? 'اسم العضو الجديد:' : 'New member name:');
        if (!name) return;

        try {
            const newMember = {
                name: name.trim(),
                teamCode: currentTeamCode,
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            };

            const docRef = await db.collection('teamMembers').add(newMember);

            // Update local cache
            if (!this.teamMembersCache) {
                this.teamMembersCache = [];
            }
            this.teamMembersCache.push({
                id: docRef.id,
                ...newMember
            });

            // Update global state
            window.appUtils.setTeamMembers(this.teamMembersCache);

            await this.renderMembersTable();
        } catch (error) {
            console.error('Error adding member:', error);
            alert(currentLanguage === 'ar' ? 'خطأ في إضافة العضو' : 'Error adding member');
        }
    },

    // Edit Member
    editMember(memberId) {
        const teamMembers = this.teamMembersCache || window.appUtils.teamMembers();
        const currentLanguage = window.appUtils.currentLanguage();

        const member = teamMembers.find(m => m.id === memberId);
        if (!member) return;

        const newName = prompt(
            currentLanguage === 'ar' ? 'تعديل اسم العضو:' : 'Edit member name:',
            member.name
        );

        if (newName && newName.trim() !== member.name) {
            this.updateMemberName(memberId, newName.trim());
        }
    },

    // Delete Member
    async deleteMember(memberId) {
        const currentLanguage = window.appUtils.currentLanguage();
        const { db } = window.appUtils;

        if (!confirm(currentLanguage === 'ar' ? 'هل أنت متأكد من حذف هذا العضو؟' : 'Are you sure you want to delete this member?')) {
            return;
        }

        try {
            await db.collection('teamMembers').doc(memberId).delete();

            // Update local cache
            if (this.teamMembersCache) {
                this.teamMembersCache = this.teamMembersCache.filter(m => m.id !== memberId);
            }

            // Update global state
            const teamMembers = window.appUtils.teamMembers();
            const updatedMembers = teamMembers.filter(m => m.id !== memberId);
            window.appUtils.setTeamMembers(updatedMembers);

            // Remove from scores cache
            if (this.currentScoresCache && this.currentScoresCache[memberId]) {
                delete this.currentScoresCache[memberId];
            }

            await this.renderMembersTable();
        } catch (error) {
            console.error('Error deleting member:', error);
        }
    },

    // Update Member Score (optimized for subcollection structure)
    async updateMemberScore(memberId, product, score) {
        try {
            const numScore = parseInt(score) || 0;

            // Use the new subcollection-based save method
            await this.saveMemberScore(memberId, product, numScore);

            // Update local data in team members cache
            if (this.teamMembersCache) {
                const member = this.teamMembersCache.find(m => m.id === memberId);
                if (member) {
                    if (!member.scores) member.scores = {};
                    member.scores[product] = numScore;
                }
            }

            // Re-render table to show updated scores
            await this.renderMembersTable();
        } catch (error) {
            console.error('Error updating score:', error);
            const currentLanguage = window.appUtils.currentLanguage();
            alert(currentLanguage === 'ar' ? 'خطأ في تحديث النقاط' : 'Error updating score');
        }
    },

    // Update Member Name
    async updateMemberName(memberId, name) {
        const { db } = window.appUtils;

        try {
            await db.collection('teamMembers').doc(memberId).update({
                name: name,
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            });

            // Update local cache
            if (this.teamMembersCache) {
                const member = this.teamMembersCache.find(m => m.id === memberId);
                if (member) {
                    member.name = name;
                }
            }

            // Update global state
            const teamMembers = window.appUtils.teamMembers();
            const member = teamMembers.find(m => m.id === memberId);
            if (member) {
                member.name = name;
            }

            await this.renderMembersTable();
        } catch (error) {
            console.error('Error updating member name:', error);
        }
    },

    async uploadAndSaveMemberImage(memberId) {
        try {
            window.appUtils.showLoadingIndicator();
            await this.uploadMemberImage(memberId);
        } catch (error) {
            console.error('Error uploading image:', error);
            const currentLanguage = window.appUtils.currentLanguage();
            alert(currentLanguage === 'ar' ? 'خطأ في رفع الصورة' : 'Error uploading image');
        } finally {
            window.appUtils.hideLoadingIndicator();
        }
    },
    async uploadMemberImage(memberId) {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'image/*';

        return new Promise((resolve, reject) => {
            input.onchange = async (e) => {
                const file = e.target.files[0];
                if (!file) {
                    resolve(null);
                    return;
                }

                // Check file size (limit to 2MB)
                if (file.size > 2 * 1024 * 1024) {
                    const currentLanguage = window.appUtils.currentLanguage();
                    alert(currentLanguage === 'ar' ? 'حجم الصورة كبير جداً (الحد الأقصى 2MB)' : 'Image size too large (max 2MB)');
                    resolve(null);
                    return;
                }

                const reader = new FileReader();
                reader.onload = async () => {
                    try {
                        const base64 = reader.result;
                        await this.saveMemberImage(memberId, base64);
                        resolve(base64);
                    } catch (error) {
                        reject(error);
                    }
                };
                reader.onerror = reject;
                reader.readAsDataURL(file);
            };

            input.click();
        });
    },
    async saveMemberImage(memberId, base64Image) {
        const { db } = window.appUtils;

        try {
            await db.collection('teamMembers').doc(memberId).update({
                teamMemberImage: base64Image,
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            });

            // Update local cache
            if (this.teamMembersCache) {
                const member = this.teamMembersCache.find(m => m.id === memberId);
                if (member) {
                    member.teamMemberImage = base64Image;
                }
            }

            // Update global state
            const teamMembers = window.appUtils.teamMembers();
            const member = teamMembers.find(m => m.id === memberId);
            if (member) {
                member.teamMemberImage = base64Image;
            }

            await this.renderMembersTable();

        } catch (error) {
            console.error('Error saving member image:', error);
            throw error;
        }
    },

    // Clear caches when switching teams or refreshing
    clearCache() {
        this.teamMembersCache = null;
        this.currentScoresCache = null;
    },

    // Refresh dashboard data
    async refreshDashboard() {
        this.clearCache();
        const currentTeamCode = window.appUtils.currentTeamCode();
        if (currentTeamCode) {
            await this.loadTeamMembers(currentTeamCode);
        }
    }
};

// Register module globally
window.modules = window.modules || {};
window.modules.dashboard = DashboardModule;

// Make functions globally accessible for HTML onclick handlers
window.uploadAndSaveMemberImage = DashboardModule.uploadAndSaveMemberImage.bind(DashboardModule);
window.addMember = DashboardModule.addMember.bind(DashboardModule);
window.editMember = DashboardModule.editMember.bind(DashboardModule);
window.deleteMember = DashboardModule.deleteMember.bind(DashboardModule);
window.updateMemberScore = DashboardModule.updateMemberScore.bind(DashboardModule);

export default DashboardModule;