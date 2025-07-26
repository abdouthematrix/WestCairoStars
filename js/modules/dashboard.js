//==========================Dashboard Module==================================//

const DashboardModule = {
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

            window.appUtils.setTeamMembers(members);
            this.renderMembersTable();
        } catch (error) {
            console.error('Error loading team members:', error);
            window.appUtils.showErrorMessage('Error loading team members');
        } finally {
            window.appUtils.hideLoadingIndicator();
        }
    },

    // Render Members Table with both scores and reviewed scores
    renderMembersTable() {
        const tbody = document.getElementById('membersTable');
        if (!tbody) return;

        const teamMembers = window.appUtils.teamMembers();
        const currentLanguage = window.appUtils.currentLanguage();
        const { products } = window.appUtils;
        tbody.innerHTML = '';

        teamMembers.forEach(member => {
            const row = document.createElement('tr');
            const regularScores = member.scores || {};
            const reviewedScores = member.reviewedScores || {};
            const effectiveScores = window.scoreUtils.getEffectiveScores(member);
            const total = window.scoreUtils.calculateTotalScore(member);

            // Check if reviewed scores exist
            const hasReviewedScores = Object.values(reviewedScores).some(score => score > 0);

            row.innerHTML = `
                <td>${member.name}</td>
                ${products.map(product => {
                const regularScore = regularScores[product] || 0;
                const reviewedScore = reviewedScores[product] || 0;

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

            // Update local array
            const teamMembers = window.appUtils.teamMembers();
            teamMembers.push({
                id: docRef.id,
                ...newMember
            });
            window.appUtils.setTeamMembers(teamMembers);

            this.renderMembersTable();
        } catch (error) {
            console.error('Error adding member:', error);
            alert(currentLanguage === 'ar' ? 'خطأ في إضافة العضو' : 'Error adding member');
        }
    },

    // Edit Member
    editMember(memberId) {
        const teamMembers = window.appUtils.teamMembers();
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

            // Update local array
            const teamMembers = window.appUtils.teamMembers();
            const updatedMembers = teamMembers.filter(m => m.id !== memberId);
            window.appUtils.setTeamMembers(updatedMembers);

            this.renderMembersTable();
        } catch (error) {
            console.error('Error deleting member:', error);
        }
    },

    // Update Member Score
    async updateMemberScore(memberId, product, score) {
        const { db } = window.appUtils;

        try {
            const numScore = parseInt(score) || 0;
            await db.collection('teamMembers').doc(memberId).update({
                [`scores.${product}`]: numScore,
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            });

            // Update local data
            const teamMembers = window.appUtils.teamMembers();
            const member = teamMembers.find(m => m.id === memberId);
            if (member) {
                if (!member.scores) member.scores = {};
                member.scores[product] = numScore;
            }

            this.renderMembersTable();
        } catch (error) {
            console.error('Error updating score:', error);
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

            // Update local data
            const teamMembers = window.appUtils.teamMembers();
            const member = teamMembers.find(m => m.id === memberId);
            if (member) {
                member.name = name;
            }

            this.renderMembersTable();
        } catch (error) {
            console.error('Error updating member name:', error);
        }
    }
};

// Register module globally
window.modules = window.modules || {};
window.modules.dashboard = DashboardModule;

// Make functions globally accessible for HTML onclick handlers
window.addMember = DashboardModule.addMember.bind(DashboardModule);
window.editMember = DashboardModule.editMember.bind(DashboardModule);
window.deleteMember = DashboardModule.deleteMember.bind(DashboardModule);
window.updateMemberScore = DashboardModule.updateMemberScore.bind(DashboardModule);

export default DashboardModule;