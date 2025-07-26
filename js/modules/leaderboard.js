//==========================Leaderboard Module==================================//

const LeaderboardModule = {
    // Load all leaderboard data
    async loadLeaderboards() {
        try {
            window.appUtils.showLoadingIndicator();

            await Promise.all([
                this.loadTopAchievers(),
                this.loadTopTeams(),
                this.loadTopTeamLeaders()
            ]);
        } catch (error) {
            console.error('Error loading leaderboards:', error);
            window.appUtils.showErrorMessage('Error loading leaderboards');
        } finally {
            window.appUtils.hideLoadingIndicator();
        }
    },

    // Load Top Achievers (individuals with 2+ products)
    async loadTopAchievers() {
        const { db, products } = window.appUtils;

        try {
            const snapshot = await db.collection('teamMembers').get();
           
            const achieverPromises = snapshot.docs.map(async (doc) => {
                const data = doc.data();
                const teamId = data.teamCode;
                const memberId = doc.id;
                const dailyScores = await window.appUtils.loadDailyScores(memberId, teamId, window.appUtils.getTodayString());
                const effectiveScores = window.scoreUtils.getEffectiveScores(dailyScores);
                const productsWithScore = products.filter(p => effectiveScores[p] > 0).length;

                if (productsWithScore >= 2) {
                    const totalScore = window.scoreUtils.calculateTotalScore(dailyScores);
                    return {
                        name: data.name,
                        score: totalScore,
                        teamCode: data.teamCode
                    };
                }
                return null;
            });

            const achievers = (await Promise.all(achieverPromises)).filter(Boolean);

            achievers.sort((a, b) => b.score - a.score);
            this.renderLeaderboard('top-achievers', achievers.slice(0, 10));
        } catch (error) {
            console.error('Error loading top achievers:', error);
        }
    },

    // Load Top Teams (by total team score, all members active)
    async loadTopTeams() {
        const { db } = window.appUtils;

        try {
            const teamsSnapshot = await db.collection('teams').get();
            const teams = [];

            for (const teamDoc of teamsSnapshot.docs) {
                const teamData = teamDoc.data();
                const teamId = teamDoc.id;

                // Skip admin teams from leaderboard
                if (teamData.isAdmin) continue;

                const membersSnapshot = await db.collection('teamMembers')
                    .where('teamCode', '==', teamDoc.id)
                    .get();

                const memberPromises = membersSnapshot.docs.map(async memberDoc => {
                    const memberData = memberDoc.data();
                    const memberId = memberDoc.id;
                    const dailyScores = await window.appUtils.loadDailyScores(memberId, teamId, window.appUtils.getTodayString());
                    const memberTotal = await window.scoreUtils.calculateTotalScore(dailyScores);
                    return { memberTotal };
                });

                const results = await Promise.all(memberPromises);
                let allMembersActive = true;
                let totalScore = 0;

                for (const { memberTotal } of results) {
                    if (memberTotal === 0) {
                        allMembersActive = false;
                    }
                    totalScore += memberTotal;
                }

                if (allMembersActive && membersSnapshot.size > 0 && teamData.leader) {
                    teams.push({
                        name: teamData.leader,
                        team: teamData.name || teamDoc.id,
                        score: totalScore
                    });
                }
            }

            teams.sort((a, b) => b.score - a.score);
            this.renderLeaderboard('top-leaders', teams.slice(0, 10));
        } catch (error) {
            console.error('Error loading top team leaders:', error);
        }
    },

    // Load Top Team Leaders (teams by total score)
    async loadTopTeamLeaders() {
        const { db } = window.appUtils;

        try {
            const teamsSnapshot = await db.collection('teams').get();
            const leaders = [];

            for (const teamDoc of teamsSnapshot.docs) {
                const teamData = teamDoc.data();
                const teamId = teamDoc.id;

                // Skip admin teams from leaderboard
                if (teamData.isAdmin) continue;

                const membersSnapshot = await db.collection('teamMembers')
                    .where('teamCode', '==', teamDoc.id)
                    .get();

                const memberPromises = membersSnapshot.docs.map(async memberDoc => {
                    const memberData = memberDoc.data();
                    const memberId = memberDoc.id;
                    const dailyScores = await window.appUtils.loadDailyScores(memberId, teamId, window.appUtils.getTodayString());
                    const memberTotal = window.scoreUtils.calculateTotalScore(dailyScores);
                    return memberTotal;
                });

                const memberTotals = await Promise.all(memberPromises);
                let allMembersActive = true;
                let totalScore = 0;

                for (const memberTotal of memberTotals) {
                    if (memberTotal === 0) {
                        allMembersActive = false;
                    }
                    totalScore += memberTotal;
                }

                if (allMembersActive && membersSnapshot.size > 0) {
                    leaders.push({
                        name: teamData.name || teamDoc.id,
                        score: totalScore
                    });
                }
            }

            leaders.sort((a, b) => b.score - a.score);
            this.renderLeaderboard('top-teams', leaders.slice(0, 10));
        } catch (error) {
            console.error('Error loading top teams:', error);
        }
    },

    // Render leaderboard with enhanced styling
    renderLeaderboard(containerId, data) {
        const container = document.getElementById(containerId);
        if (!container) return;

        const currentLanguage = window.appUtils.currentLanguage();

        if (data.length === 0) {
            container.innerHTML = `
                <p style="text-align: center; color: var(--text-secondary); padding: 20px;">
                    ${currentLanguage === 'ar' ? 'لا توجد بيانات' : 'No data available'}
                </p>
            `;
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
    },

    // Refresh leaderboards (can be called from other modules)
    async refreshLeaderboards() {
        await this.loadLeaderboards();
    }
};

// Register module globally
window.modules = window.modules || {};
window.modules.leaderboard = LeaderboardModule;

export default LeaderboardModule;