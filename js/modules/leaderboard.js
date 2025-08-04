// Leaderboard Module - Optimized for Subcollection Structure
// Firestore structure: scores/{date}/{teamId}/{memberId}

const LeaderboardModule = {
    // Current filter state
    currentDateFilter: 'today',
    currentStartDate: null,
    currentEndDate: null,

    // Cache for member details and teams
    memberDetailsCache: null,
    teamsCache: null,

    // Initialize leaderboard
    async initializeLeaderboard() {
        this.initializeDateFilters();
        await this.loadLeaderboards();
    },

    // Initialize date filters
    initializeDateFilters() {
        this.currentStartDate = this.currentEndDate = window.appUtils.getTodayString();

        const startDateInput = document.getElementById('start-date');
        const endDateInput = document.getElementById('end-date');

        if (startDateInput) startDateInput.value = this.currentStartDate;
        if (endDateInput) endDateInput.value = this.currentEndDate;

        this.updateFilterStates();
    },

    // Update filter UI states
    updateFilterStates() {
        // Update active button
        document.querySelectorAll('.filter-btn').forEach(btn => btn.classList.remove('active'));
        const activeButton = document.getElementById(`filter-${this.currentDateFilter}`);
        if (activeButton) activeButton.classList.add('active');

        // Update date range picker visibility
        const dateRangePicker = document.getElementById('date-range-picker');
        if (dateRangePicker) {
            if (this.currentDateFilter === 'range') {
                dateRangePicker.classList.remove('hidden');
                dateRangePicker.classList.add('visible');
            } else {
                dateRangePicker.classList.add('hidden');
                dateRangePicker.classList.remove('visible');
            }
        }

        // Update date inputs
        const startDateInput = document.getElementById('start-date');
        const endDateInput = document.getElementById('end-date');
        if (startDateInput && this.currentStartDate) startDateInput.value = this.currentStartDate;
        if (endDateInput && this.currentEndDate) endDateInput.value = this.currentEndDate;

        // Update range display
        const rangeDisplay = document.getElementById('current-range-display');
        if (rangeDisplay) rangeDisplay.textContent = this.getCurrentRangeText();

        this.updateLanguageTexts();
    },

    // Update language texts
    updateLanguageTexts() {
        const currentLanguage = window.appUtils.currentLanguage();
        document.querySelectorAll('[data-en][data-ar]').forEach(element => {
            if (element.getAttribute('data-en') && element.getAttribute('data-ar')) {
                element.textContent = currentLanguage === 'ar' ?
                    element.getAttribute('data-ar') :
                    element.getAttribute('data-en');
            }
        });
    },

    // Set date filter
    async setDateFilter(filterType) {
        this.currentDateFilter = filterType;
        const today = new Date();

        switch (filterType) {
            case 'today':
                this.currentStartDate = this.currentEndDate = window.appUtils.getTodayString();
                break;
            case 'yesterday':
                this.currentStartDate = this.currentEndDate = window.appUtils.getYesterdayString();
                break;

            case 'week':
                const startOfWeek = new Date(today);
                startOfWeek.setDate(today.getDate() - today.getDay());
                const endOfWeek = new Date(startOfWeek);
                endOfWeek.setDate(startOfWeek.getDate() + 6);

                this.currentStartDate = startOfWeek.toISOString().split('T')[0];
                this.currentEndDate = endOfWeek.toISOString().split('T')[0];
                break;

            case 'month':
                const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
                const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0);

                this.currentStartDate = startOfMonth.toISOString().split('T')[0];
                this.currentEndDate = endOfMonth.toISOString().split('T')[0];
                break;

            case 'range':
                this.updateFilterStates();
                return;
        }

        this.updateFilterStates();
        await this.loadLeaderboards();
    },

    // Apply custom date range
    async applyDateRange() {
        const startDate = document.getElementById('start-date')?.value;
        const endDate = document.getElementById('end-date')?.value;

        if (!startDate || !endDate) {
            const currentLanguage = window.appUtils.currentLanguage();
            alert(currentLanguage === 'ar' ? 'يرجى تحديد تاريخ البداية والنهاية' : 'Please select both start and end dates');
            return;
        }

        if (startDate > endDate) {
            const currentLanguage = window.appUtils.currentLanguage();
            alert(currentLanguage === 'ar' ? 'تاريخ البداية يجب أن يكون قبل تاريخ النهاية' : 'Start date must be before end date');
            return;
        }

        this.currentStartDate = startDate;
        this.currentEndDate = endDate;

        this.updateFilterStates();
        await this.loadLeaderboards();
    },

    // Get current range text
    getCurrentRangeText() {
        const currentLanguage = window.appUtils.currentLanguage();

        if (!this.currentStartDate || !this.currentEndDate) {
            return currentLanguage === 'ar' ? 'لم يتم تحديد نطاق' : 'No range selected';
        }

        if (this.currentStartDate === this.currentEndDate) {
            return `${currentLanguage === 'ar' ? 'التاريخ:' : 'Date:'} ${this.formatDate(this.currentStartDate)}`;
        }

        return `${currentLanguage === 'ar' ? 'من:' : 'From:'} ${this.formatDate(this.currentStartDate)} ${currentLanguage === 'ar' ? 'إلى:' : 'to:'} ${this.formatDate(this.currentEndDate)}`;
    },

    // Format date
    formatDate(dateString) {
        const date = new Date(dateString);
        const currentLanguage = window.appUtils.currentLanguage();

        return date.toLocaleDateString(currentLanguage === 'ar' ? 'ar-EG' : 'en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        });
    },

    // Generate date range array
    getDateRange(startDate, endDate) {
        const dates = [];
        const current = new Date(startDate);
        const end = new Date(endDate);

        while (current <= end) {
            dates.push(current.toISOString().split('T')[0]);
            current.setDate(current.getDate() + 1);
        }

        return dates;
    },

    // Load all leaderboards
    async loadLeaderboards() {
        try {
            window.appUtils.showLoadingIndicator();

            if (!this.currentStartDate || !this.currentEndDate) {
                this.currentStartDate = this.currentEndDate = window.appUtils.getTodayString();
            }

            await Promise.all([
                this.loadTopAchievers(),
                this.loadTopTeams(),
                this.loadTopTeamLeaders(),
                this.loadTeamsWithZeroScores()
            ]);
        } catch (error) {
            console.error('Error loading leaderboards:', error);
            window.appUtils.showErrorMessage('Error loading leaderboards');
        } finally {
            window.appUtils.hideLoadingIndicator();
        }
    },

    // Get cached member details
    async getMemberDetails() {
        if (this.memberDetailsCache) {
            return this.memberDetailsCache;
        }

        const { db } = window.appUtils;
        const membersSnapshot = await db.collection('teamMembers').get();

        this.memberDetailsCache = {};
        membersSnapshot.docs.forEach(doc => {
            this.memberDetailsCache[doc.id] = {
                name: doc.data().name,
                teamCode: doc.data().teamCode,
                image: doc.data().teamMemberImage
            };
        });

        return this.memberDetailsCache;
    },

    // Get cached teams data
    async getTeamsData() {
        if (this.teamsCache) {
            return this.teamsCache;
        }

        const { db } = window.appUtils;
        const teamsSnapshot = await db.collection('teams')
            .where('isAdmin', '==', false)
            .get();

        this.teamsCache = {};
        teamsSnapshot.docs.forEach(doc => {
            this.teamsCache[doc.id] = doc.data();
        });

        return this.teamsCache;
    },

    // Get aggregated scores from subcollections (ONLY AVAILABLE MEMBERS)
    async getAggregatedScores() {
        const { db } = window.appUtils;

        // Get date range and member details
        const dateRange = this.getDateRange(this.currentStartDate, this.currentEndDate);
        const memberDetails = await this.getMemberDetails();

        // Group members by team for efficient querying
        const membersByTeam = {};
        Object.entries(memberDetails).forEach(([memberId, details]) => {
            const teamCode = details.teamCode;
            if (!membersByTeam[teamCode]) {
                membersByTeam[teamCode] = [];
            }
            membersByTeam[teamCode].push(memberId);
        });

        // This will ONLY contain AVAILABLE members (those not marked unavailable)
        const aggregatedData = {};

        // Create all query promises for parallel execution
        const queryPromises = [];

        for (const date of dateRange) {
            for (const teamCode of Object.keys(membersByTeam)) {
                const promise = db.collection('scores')
                    .doc(date)
                    .collection(teamCode)
                    .get()
                    .then(snapshot => ({
                        date,
                        teamCode,
                        snapshot
                    }))
                    .catch(error => {
                        // Silently handle missing documents (no scores for this date/team)
                        return null;
                    });

                queryPromises.push(promise);
            }
        }

        // Execute all queries in parallel
        const results = await Promise.all(queryPromises);

        // Process results - SKIP UNAVAILABLE MEMBERS
        results.filter(Boolean).forEach(({ date, teamCode, snapshot }) => {
            snapshot.docs.forEach(doc => {
                const memberId = doc.id;
                const data = doc.data();

                // Skip if member is unavailable for this date
                if (data.unavailable === true) {
                    return;
                }

                // Skip if member doesn't exist in our member details
                const memberDetail = memberDetails[memberId];
                if (!memberDetail) {
                    return;
                }

                // Initialize member aggregation (only for available members)
                if (!aggregatedData[memberId]) {
                    aggregatedData[memberId] = {
                        memberId,
                        teamCode: memberDetail.teamCode,
                        totalScores: {},
                        totalReviewedScores: {},
                        activeDays: new Set(),
                        dates: new Set()
                    };

                    // Initialize all products to 0
                    window.appUtils.products.forEach(product => {
                        aggregatedData[memberId].totalScores[product] = 0;
                        aggregatedData[memberId].totalReviewedScores[product] = 0;
                    });
                }

                // Track this date
                aggregatedData[memberId].dates.add(date);

                // Get scores
                const memberScores = data.scores || {};
                const memberReviewedScores = data.reviewedScores || {};

                // Check for activity
                const hasActivity = Object.values(memberScores).some(score => score > 0) ||
                    Object.values(memberReviewedScores).some(score => score > 0);

                if (hasActivity) {
                    aggregatedData[memberId].activeDays.add(date);
                }

                // Aggregate scores
                window.appUtils.products.forEach(product => {
                    aggregatedData[memberId].totalScores[product] += (memberScores[product] || 0);
                    aggregatedData[memberId].totalReviewedScores[product] += (memberReviewedScores[product] || 0);
                });
            });
        });

        // Convert Sets to counts
        Object.values(aggregatedData).forEach(member => {
            member.activeDays = member.activeDays.size;
            member.totalDays = member.dates.size;
        });

        return aggregatedData;
    },

    // Load Top Achievers (ONLY AVAILABLE MEMBERS)
    async loadTopAchievers() {
        try {
            const scoresData = await this.getAggregatedScores(); // Only available members
            const memberDetails = await this.getMemberDetails();
            const teamsData = await this.getTeamsData();

            const achievers = Object.values(scoresData)
                .map(member => {
                    const details = memberDetails[member.memberId];
                    if (!details) return null;
                    const teamData = teamsData[details.teamCode];

                    // Use reviewed scores if available
                    const effectiveScores = member?.totalReviewedScores ?? member?.totalScores ?? {};

                    const productsWithScore = window.appUtils.products.filter(p => effectiveScores[p] > 0).length;

                    if (productsWithScore >= 2) {
                        const totalScore = window.appUtils.products.reduce((sum, product) => sum + (effectiveScores[product] || 0), 0);
                        return {
                            name: details.name,
                            score: totalScore,
                            teamCode: details.teamCode,
                            team: teamData?.name || details.teamCode,
                            image: details.image,
                            productsCount: productsWithScore,
                            activeDays: member.activeDays
                        };
                    }
                    return null;
                })
                .filter(Boolean)
                .sort((a, b) => {
                    if (b.score !== a.score) return b.score - a.score;
                    return b.productsCount - a.productsCount;
                });

            this.renderLeaderboard('top-achievers', achievers.slice(0, 10));
        } catch (error) {
            console.error('Error loading top achievers:', error);
            this.renderErrorLeaderboard('top-achievers');
        }
    },

    // Load Top Teams (ONLY AVAILABLE MEMBERS)
    async loadTopTeams() {
        try {
            const scoresData = await this.getAggregatedScores(); // Only available members
            const memberDetails = await this.getMemberDetails();
            const teamsData = await this.getTeamsData();

            // Group scores by team (only available members)
            const teamScores = {};
            Object.values(scoresData).forEach(member => {
                const details = memberDetails[member.memberId];
                if (!details) return;

                const teamCode = details.teamCode;
                if (!teamScores[teamCode]) {
                    teamScores[teamCode] = {
                        members: [],
                        totalScore: 0,
                        availableMembers: 0
                    };
                }

                const effectiveScores = member?.totalReviewedScores ?? member?.totalScores ?? {};
                const memberScore = window.appUtils.products.reduce(
                    (sum, product) => sum + (effectiveScores[product] || 0), 0
                );

                teamScores[teamCode].members.push({
                    ...details,
                    score: memberScore,
                    hasActivity: memberScore > 0
                });

                teamScores[teamCode].totalScore += memberScore;
                teamScores[teamCode].availableMembers += 1;
            });

            // Process teams (only teams where ALL available members are active)
            const teams = [];
            Object.entries(teamScores).forEach(([teamId, teamScore]) => {
                const teamData = teamsData[teamId];
                const availableMembersInTeam = teamScore.availableMembers;

                if (teamData && availableMembersInTeam > 0) {
                    const activeMembersWithScores = teamScore.members.filter(m => m.hasActivity).length;
                    const membersWithZeroScores = teamScore.members.filter(m => !m.hasActivity).length;

                    // Check if ALL available members are active (no zero scores allowed)
                    if (activeMembersWithScores === availableMembersInTeam && membersWithZeroScores === 0) {
                        teams.push({
                            name: teamData.name || teamId,
                            score: teamScore.totalScore,
                            membersCount: availableMembersInTeam
                        });
                    }
                }
            });

            teams.sort((a, b) => b.score - a.score);
            this.renderLeaderboard('top-teams', teams.slice(0, 10));

        } catch (error) {
            console.error('Error loading top teams:', error);
            this.renderErrorLeaderboard('top-teams');
        }
    },

    // Load Top Team Leaders (ONLY AVAILABLE MEMBERS)
    async loadTopTeamLeaders() {
        try {
            const scoresData = await this.getAggregatedScores(); // Only available members
            const memberDetails = await this.getMemberDetails();
            const teamsData = await this.getTeamsData();

            // Group scores by team (only available members)
            const teamScores = {};
            Object.values(scoresData).forEach(member => {
                const details = memberDetails[member.memberId];
                if (!details) return;              
                const teamCode = details.teamCode;               
                if (!teamScores[teamCode]) {
                    teamScores[teamCode] = {
                        members: [],
                        totalScore: 0,
                        availableMembers: 0
                    };
                }

                const effectiveScores = member?.totalReviewedScores ?? member?.totalScores ?? {};
                const memberScore = window.appUtils.products.reduce(
                    (sum, product) => sum + (effectiveScores[product] || 0), 0
                );

                teamScores[teamCode].members.push({
                    ...details,
                    score: memberScore,
                    hasActivity: memberScore > 0
                });

                teamScores[teamCode].totalScore += memberScore;
                teamScores[teamCode].availableMembers += 1;
            });

            // Process leaders (only teams where ALL available members are active)
            const leaders = [];
            Object.entries(teamScores).forEach(([teamId, teamScore]) => {
                const teamData = teamsData[teamId];
                const availableMembersInTeam = teamScore.availableMembers;

                if (teamData?.leader && availableMembersInTeam > 0) {
                    const activeMembersWithScores = teamScore.members.filter(m => m.hasActivity).length;
                    const membersWithZeroScores = teamScore.members.filter(m => !m.hasActivity).length;

                    // Check if ALL available members are active (no zero scores allowed)
                    if (activeMembersWithScores === availableMembersInTeam && membersWithZeroScores === 0) {
                        leaders.push({
                            name: teamData.leader,
                            team: teamData.name || teamId,
                            score: teamScore.totalScore,
                            membersCount: availableMembersInTeam
                        });
                    }
                }
            });

            leaders.sort((a, b) => b.score - a.score);
            this.renderLeaderboard('top-leaders', leaders.slice(0, 10));

        } catch (error) {
            console.error('Error loading top team leaders:', error);
            this.renderErrorLeaderboard('top-leaders');
        }
    },

    // Load Teams With Zero Scores (ONLY AVAILABLE MEMBERS)
    async loadTeamsWithZeroScores() {
        try {
            const [scoresData, memberDetails, teamsData] = await Promise.all([
                this.getAggregatedScores(), // Only available members
                this.getMemberDetails(),
                this.getTeamsData()
            ]);

            const lang = window.appUtils.currentLanguage();
            const teamScores = {};

            // Step 1: Collect and evaluate scores per team (only available members from scoresData)
            Object.entries(scoresData).forEach(([memberId, scoreEntry]) => {
                const details = memberDetails[memberId];
                if (!details) return;

                const teamCode = details.teamCode;
                if (!teamScores[teamCode]) {
                    teamScores[teamCode] = {
                        totalScore: 0,
                        hasZeroScoreMembers: false,
                        members: []
                    };
                }

                const isReviewed = !!scoreEntry?.totalReviewedScores && 
                    Object.values(scoreEntry.totalReviewedScores).some(score => score > 0);
                
                const effectiveScores = isReviewed
                    ? scoreEntry.totalReviewedScores
                    : scoreEntry?.totalScores ?? {};

                const memberScore = window.appUtils.products.reduce(
                    (sum, product) => sum + (effectiveScores[product] || 0),
                    0
                );

                teamScores[teamCode].members.push({
                    ...details,
                    score: memberScore,
                    isReviewed
                });

                if (memberScore === 0) {
                    teamScores[teamCode].hasZeroScoreMembers = true;
                }

                teamScores[teamCode].totalScore += memberScore;
            });

            // Step 2: Extract teams with zero-score members (only available members)
            const teamsWithZeroScores = Object.entries(teamScores)
                .filter(([_, team]) => team.hasZeroScoreMembers)
                .map(([teamId, team]) => {
                    const zeroMembers = team.members.filter(m => m.score === 0);
                    return {
                        name: teamsData[teamId]?.name || teamId,
                        leader: teamsData[teamId]?.leader || '—',
                        score: team.totalScore,
                        zeroScoreCount: zeroMembers.length,
                        zeroScoreMembers: zeroMembers.map(m => ({
                            name: m.name,
                            isReviewed: m.isReviewed
                        }))
                    };
                })
                .sort((a, b) => b.score - a.score);

            // Step 3: Render
            const container = document.getElementById('teams-with-zero-scores');
            if (!container) return;

            if (teamsWithZeroScores.length === 0) {
                container.innerHTML = `
            <p style="text-align: center; color: var(--text-secondary); padding: 20px;">
                ${lang === 'ar' ? 'لا يوجد أعضاء بدون انتاجية' : 'No zero-score members'}
            </p>`;
                return;
            }

            container.innerHTML = `
        <div class="zero-score-table-wrapper">
            <table class="zero-score-table">
                <thead>
                    <tr>
                        <th>${lang === 'ar' ? 'الفريق' : 'Team'}</th>
                        <th>${lang === 'ar' ? 'القائد' : 'Leader'}</th>
                        <th>${lang === 'ar' ? 'عدد الأعضاء بدون انتاجية' : 'Zero Members'}</th>
                        <th>${lang === 'ar' ? 'أسماء الأعضاء' : 'Member Names'}</th>
                    </tr>
                </thead>
                <tbody>
                    ${teamsWithZeroScores.map(team => `
                        <tr>
                            <td>${team.name}</td>
                            <td class="leader-cell">${team.leader}</td>
                            <td><span class="count-badge">${team.zeroScoreCount}</span></td>
                            <td class="member-names">
                                ${team.zeroScoreMembers.map(m => `
                                    <span class="member-badge ${m.isReviewed ? 'reviewed' : ''}">
                                        ${m.name}${m.isReviewed ? ' ✅' : ''}
                                    </span>
                                `).join('')}
                            </td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        </div>
    `;

        } catch (error) {
            console.error('Error loading teams with zero scores:', error);
            this.renderErrorLeaderboard('teams-with-zero-scores');
        }
    },

    // Update the renderLeaderboard function
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

        // Check if this is a ribbon leaderboard (top-achievers or top-leaders)
        const isRibbonLeaderboard = containerId === 'top-achievers' || containerId === 'top-leaders';

        if (isRibbonLeaderboard) {
            container.innerHTML = data.map((item, index) => {
                const position = index + 1;
                const trophy = position === 1 ? '🏆' : position === 2 ? '🥈' : position === 3 ? '🥉' : '';
                const rankClass = position === 1 ? 'rank-1' : position === 2 ? 'rank-2' : position === 3 ? 'rank-3' : 'rank-other';
                               
                return `
                <div class="ribbon-member-card ${rankClass}">
                    <div class="ribbon-position-badge ${rankClass}">#${position}</div>
                    ${trophy ? `<div class="ribbon-trophy-icon">${trophy}</div>` : ''}
                    
                    <img src="${item.image}" 
                         class="ribbon-member-image"
                         onerror="this.src=''">
                    
                    <div class="ribbon ribbon-small">
                        <div class="member-info-container">
                            <div class="member-name-display">${item.name}</div>
                            <div class="member-score-display">${item.score}</div>
                            <div class="member-name-display">${item.team}</div>
                        </div>
                    </div>
                </div>
            `;
            }).join('');
        } else {
            // Use the original rendering for other leaderboards
            container.innerHTML = data.map((item, index) => {
                const trophy = index === 0 ? '🏆' : index === 1 ? '🥈' : index === 2 ? '🥉' : '';
                return `
                <div class="leaderboard-item">
                    <span class="rank">#${index + 1}</span>
                    <span class="name">${item.name}</span>                    
                     <span class="score">${item.score}
                          <span class="trophy">${trophy}
                     </span>
                    </span>
                </div>
            `;
            }).join('');
        }
    },
    // Render error state
    renderErrorLeaderboard(containerId) {
        const container = document.getElementById(containerId);
        if (!container) return;

        const currentLanguage = window.appUtils.currentLanguage();
        container.innerHTML = `
            <div style="text-align: center; color: var(--danger-color, #dc3545); padding: 20px;">
                <p>${currentLanguage === 'ar' ? 'خطأ في تحميل البيانات' : 'Error loading data'}</p>
                <button onclick="window.modules.leaderboard.refreshLeaderboards()" 
                        style="background: var(--primary-color); color: white; border: none; padding: 8px 16px; border-radius: 4px; cursor: pointer; margin-top: 8px;">
                    ${currentLanguage === 'ar' ? 'إعادة المحاولة' : 'Retry'}
                </button>
            </div>
        `;
    },

    // Refresh leaderboards
    async refreshLeaderboards() {
        // Clear all caches
        this.memberDetailsCache = null;
        this.teamsCache = null;

        // Clear date-based caches
        const dateRange = this.getDateRange(this.currentStartDate, this.currentEndDate);
        dateRange.forEach(date => {
            window.appUtils.clearScoresCache?.(date);
        });

        await this.loadLeaderboards();
    }
};

// Register module globally
window.modules = window.modules || {};
window.modules.leaderboard = LeaderboardModule;

// Make functions globally accessible
window.setDateFilter = LeaderboardModule.setDateFilter.bind(LeaderboardModule);
window.applyDateRange = LeaderboardModule.applyDateRange.bind(LeaderboardModule);

export default LeaderboardModule;