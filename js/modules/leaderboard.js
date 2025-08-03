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

    // Get aggregated scores from subcollections
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

        // Process results
        results.filter(Boolean).forEach(({ date, teamCode, snapshot }) => {
            snapshot.docs.forEach(doc => {
                const memberId = doc.id;
                const data = doc.data();

                // Initialize member aggregation
                if (!aggregatedData[memberId]) {
                    aggregatedData[memberId] = {
                        memberId,
                        teamCode,
                        totalScores: {},
                        totalReviewedScores: {},
                        activeDays: new Set(),
                        dates: new Set()
                    };
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
                    aggregatedData[memberId].totalScores[product] =
                        (aggregatedData[memberId].totalScores[product] || 0) + (memberScores[product] || 0);

                    aggregatedData[memberId].totalReviewedScores[product] =
                        (aggregatedData[memberId].totalReviewedScores[product] || 0) + (memberReviewedScores[product] || 0);
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

    // Load Top Achievers
    async loadTopAchievers() {
        try {
            const scoresData = await this.getAggregatedScores();
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
                            team: teamData.name || details.teamCode,
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

    // Load Top Teams
    async loadTopTeams() {
        try {
            const scoresData = await this.getAggregatedScores();
            const memberDetails = await this.getMemberDetails();
            const teamsData = await this.getTeamsData();

            // Group scores by team
            const teamScores = {};
            Object.values(scoresData).forEach(member => {
                const details = memberDetails[member.memberId];
                if (!details) return;

                const teamCode = details.teamCode;
                if (!teamScores[teamCode]) {
                    teamScores[teamCode] = {
                        members: [],
                        totalScore: 0
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
            });

            // Get total member counts per team
            const teamMemberCounts = {};
            Object.values(memberDetails).forEach(member => {
                const teamCode = member.teamCode;
                teamMemberCounts[teamCode] = (teamMemberCounts[teamCode] || 0) + 1;
            });

            // Process teams (only teams where ALL members are active)
            const teams = [];
            Object.entries(teamScores).forEach(([teamId, teamScore]) => {
                const teamData = teamsData[teamId];
                const totalMembersInTeam = teamMemberCounts[teamId] || 0;

                if (teamData && totalMembersInTeam > 0) {
                    const activeMembersWithScores = teamScore.members.filter(m => m.hasActivity).length;

                    if (activeMembersWithScores === totalMembersInTeam) {
                        teams.push({
                            name: teamData.name || teamId,
                            score: teamScore.totalScore,
                            membersCount: totalMembersInTeam
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

    // Load Top Team Leaders
    async loadTopTeamLeaders() {
        try {
            const scoresData = await this.getAggregatedScores();
            const memberDetails = await this.getMemberDetails();
            const teamsData = await this.getTeamsData();

            // Group scores by team
            const teamScores = {};
            Object.values(scoresData).forEach(member => {
                const details = memberDetails[member.memberId];
                if (!details) return;              
                const teamCode = details.teamCode;               
                if (!teamScores[teamCode]) {
                    teamScores[teamCode] = {
                        members: [],
                        totalScore: 0
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
            });

            // Get total member counts per team
            const teamMemberCounts = {};
            Object.values(memberDetails).forEach(member => {
                const teamCode = member.teamCode;
                teamMemberCounts[teamCode] = (teamMemberCounts[teamCode] || 0) + 1;
            });

            // Process leaders (only teams where ALL members are active)
            const leaders = [];
            Object.entries(teamScores).forEach(([teamId, teamScore]) => {
                const teamData = teamsData[teamId];
                const totalMembersInTeam = teamMemberCounts[teamId] || 0;

                if (teamData?.leader && totalMembersInTeam > 0) {
                    const activeMembersWithScores = teamScore.members.filter(m => m.hasActivity).length;

                    if (activeMembersWithScores === totalMembersInTeam) {
                        leaders.push({
                            name: teamData.leader,
                            team: teamData.name || teamId,
                            score: teamScore.totalScore,
                            membersCount: totalMembersInTeam
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

    // Load Teams With Zero Scores
    async loadTeamsWithZeroScores() {
        try {
            const [scoresData, memberDetails, teamsData] = await Promise.all([
                this.getAggregatedScores(),
                this.getMemberDetails(),
                this.getTea