//==========================Admin Module==================================//

const AdminModule = {
    // Load all teams for admin management
    async loadAllTeamsForAdmin() {
        const container = document.getElementById('admin-teams-container');
        if (!container) return;

        container.innerHTML = '<div class="loading"><div class="spinner"></div></div>';
        const { db, products } = window.appUtils;
        const currentLanguage = window.appUtils.currentLanguage();

        try {
            // Query admin teams and regular teams separately
            const adminTeamsSnapshot = await db.collection('teams')
                .where('isAdmin', '==', true)
                .get();

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
                                        <th data-en="Secured Loan" data-ar="قرض بضمان">قرض بضمان</th>
                                        <th data-en="Secured Credit Card" data-ar="بطاقة ائتمان بضمان">بطاقة ائتمان بضمان</th>
                                        <th data-en="Unsecured Loan" data-ar="قرض بدون ضمان">قرض بدون ضمان</th>
                                        <th data-en="Unsecured Credit Card" data-ar="بطاقة ائتمان بدون ضمانة">بطاقة ائتمان بدون ضمانة</th>
                                        <th data-en="Bancassurance" data-ar="التأمين البنكي">التأمين البنكي</th>
                                        <th data-en="Total" data-ar="المجموع">المجموع</th>
                                        <th data-en="Actions" data-ar="الإجراءات">الإجراءات</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${membersSnapshot.docs.map(memberDoc => this.renderEnhancedAdminMemberRow(memberDoc, isAdminTeam)).join('')}
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
    },

    // Render enhanced admin member row
    renderEnhancedAdminMemberRow(memberDoc, isAdminTeam = false) {
        const member = memberDoc.data();
        const memberId = memberDoc.id;
        const reviewed = member.reviewedScores || {};
        const scores = member.scores || {};
        const { products } = window.appUtils;
        const currentLanguage = window.appUtils.currentLanguage();

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
            await this.loadAllTeamsForAdmin();
        } catch (error) {
            console.error('Error removing member:', error);
            alert(currentLanguage === 'ar' ? 'خطأ في حذف العضو' : 'Error removing member');
        }
    },

    // Auto-save score function
    async autoSaveScore(memberId, product, score) {
        const { db, products } = window.appUtils;

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
            await this.loadAllTeamsForAdmin();
        } catch (error) {
            console.error('Error changing team code:', error);
            alert(currentLanguage === 'ar' ? 'خطأ في تغيير رمز الفريق' : 'Error changing team code');
        }
    },

    // Reset Functions
    async resetAllScores() {
        const currentLanguage = window.appUtils.currentLanguage();
        const { db } = window.appUtils;

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
            // Get all teams excluding admin teams
            const teamsSnapshot = await db.collection('teams').get();
            const teamCodes = teamsSnapshot.docs
                .filter(doc => {
                    const data = doc.data();
                    return !data.isAdmin;
                })
                .map(doc => doc.id);

            if (teamCodes.length === 0) {
                alert(currentLanguage === 'ar' ? 'لا توجد بيانات للإعادة تعيين' : 'No data to reset');
                return;
            }

            // Get all members from non-admin teams
            const membersSnapshot = await db.collection('teamMembers')
                .where('teamCode', 'in', teamCodes)
                .get();

            if (membersSnapshot.empty) {
                alert(currentLanguage === 'ar' ? 'لا توجد بيانات للإعادة تعيين' : 'No data to reset');
                return;
            }

            // Reset all scores
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

            await this.loadAllTeamsForAdmin();

        } catch (error) {
            console.error('Error resetting scores:', error);
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

        const confirmMessage = currentLanguage === 'ar'
            ? `هل أنت متأكد من إعادة تعيين درجات لفريق "${teamName}"؟`
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

            await this.loadAllTeamsForAdmin();

        } catch (error) {
            console.error('Error resetting team scores:', error);
            alert(currentLanguage === 'ar' ? 'خطأ في إعادة تعيين درجات الفريق' : 'Error resetting team scores');
        }
    }
};

// Register module globally
window.modules = window.modules || {};
window.modules.admin = AdminModule;

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