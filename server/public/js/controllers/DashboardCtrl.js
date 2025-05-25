angular.module('DashboardCtrl', []).controller('DashboardController', function($scope, $http, $filter, $ocLazyLoad, $injector, $rootScope, $timeout, $mdDialog, $q, gettextCatalog) {
    $scope.loading = true;
    $scope.widgets = {
        personnelStats: { enabled: true, loading: false },
        chartPersonnelByStructure: { enabled: true, loading: false },
        chartPersonnelByGender: { enabled: true, loading: false },
        recentActivity: { enabled: true, loading: false },
        personnelSearch: { enabled: true, loading: false }
    };
    
    $scope.filters = {
        dateRange: {
            start: moment().subtract(30, 'days').toDate(),
            end: new Date()
        },
        structureId: null,
        status: null
    };
    
    $scope.stats = {
        totalPersonnel: 0,
        activePersonnel: 0,
        inactivePersonnel: 0,
        byGender: { male: 0, female: 0 },
        byStructure: [],
        byStatus: [],
        recentChanges: []
    };
    
    $scope.chartData = {
        genderChart: null,
        structureChart: null,
        statusChart: null
    };
    
    $scope.personnelSearchText = '';
    $scope.personnelSelected = null;
    $scope.searchResults = [];
    
    $scope.loadDashboard = function() {
        $scope.loading = true;
        $scope.loadPersonnelStats();
        $scope.loadChartData();
        $scope.loadRecentActivity();
        $timeout(function() {
            $scope.loading = false;
        }, 1000);
    };
    
    $scope.loadPersonnelStats = function() {
        $scope.widgets.personnelStats.loading = true;
        
        $ocLazyLoad.load('js/services/ChartService.js').then(function() {
            var Chart = $injector.get('Chart');
            
            Chart.build({
                name: 'global',
                from: $filter('date')($scope.filters.dateRange.start, 'yyyy-MM-dd'),
                to: $filter('date')($scope.filters.dateRange.end, 'yyyy-MM-dd'),
                globalView: { activated: false }
            }).then(function(response) {
                if (response.data) {
                    $scope.stats.totalPersonnel = response.data.totalStaff || 0;
                    $scope.stats.activePersonnel = (response.data.totalStaff || 0) - (response.data.totalNonFonctionnaire || 0);
                    $scope.stats.inactivePersonnel = response.data.totalNonFonctionnaire || 0;
                }
                $scope.widgets.personnelStats.loading = false;
            }).catch(function(error) {
                console.error('Error loading global stats:', error);
                $scope.widgets.personnelStats.loading = false;
            });
            
            Chart.build({
                name: 'chart1',
                from: $filter('date')($scope.filters.dateRange.start, 'yyyy-MM-dd'),
                to: $filter('date')($scope.filters.dateRange.end, 'yyyy-MM-dd'),
                globalView: { activated: false }
            }).then(function(response) {
                if (response.data) {
                    $scope.stats.byGender.male = response.data.totalMen || 0;
                    $scope.stats.byGender.female = response.data.totalWomen || 0;
                    $scope.prepareGenderChart();
                }
                $scope.widgets.chartPersonnelByGender.loading = false;
            }).catch(function(error) {
                console.error('Error loading gender stats:', error);
                $scope.widgets.chartPersonnelByGender.loading = false;
            });
            
            Chart.build({
                name: 'card2',
                from: $filter('date')($scope.filters.dateRange.start, 'yyyy-MM-dd'),
                to: $filter('date')($scope.filters.dateRange.end, 'yyyy-MM-dd'),
                globalView: { activated: false }
            }).then(function(response) {
                if (response.data && response.data.structures) {
                    $scope.stats.byStructure = response.data.structures;
                    $scope.prepareStructureChart();
                }
                $scope.widgets.chartPersonnelByStructure.loading = false;
            }).catch(function(error) {
                console.error('Error loading structure stats:', error);
                $scope.widgets.chartPersonnelByStructure.loading = false;
            });
        });
    };
    
    $scope.loadChartData = function() {
    };
    
    $scope.prepareGenderChart = function() {
        $scope.chartData.genderChart = {
            labels: [gettextCatalog.getString('Women'), gettextCatalog.getString('Men')],
            datasets: [{
                data: [$scope.stats.byGender.female, $scope.stats.byGender.male],
                backgroundColor: ['#E91E63', '#2196F3'],
                borderWidth: 0
            }]
        };
    };
    
    $scope.prepareStructureChart = function() {
        var labels = [];
        var data = [];
        var colors = [];
        
        var colorPalette = [
            '#2196F3', '#4CAF50', '#FF9800', '#9C27B0', '#F44336',
            '#00BCD4', '#FFEB3B', '#795548', '#607D8B', '#3F51B5'
        ];
        
        $scope.stats.byStructure.forEach(function(structure, index) {
            labels.push(structure.name);
            data.push(structure.count);
            colors.push(colorPalette[index % colorPalette.length]);
        });
        
        $scope.chartData.structureChart = {
            labels: labels,
            datasets: [{
                data: data,
                backgroundColor: colors,
                borderWidth: 0
            }]
        };
    };
    
    $scope.loadRecentActivity = function() {
        $scope.widgets.recentActivity.loading = true;
        
        $ocLazyLoad.load('js/services/AuditService.js').then(function() {
            var Audit = $injector.get('Audit');
            
            Audit.recent({
                limit: 5,
                from: $filter('date')($scope.filters.dateRange.start, 'yyyy-MM-dd'),
                to: $filter('date')($scope.filters.dateRange.end, 'yyyy-MM-dd')
            }).then(function(response) {
                if (response.data) {
                    $scope.stats.recentChanges = response.data.map(function(item) {
                        return {
                            id: item._id,
                            title: item.action,
                            description: item.details,
                            date: new Date(item.date),
                            icon: getActivityIcon(item.action),
                            user: item.user
                        };
                    });
                }
                $scope.widgets.recentActivity.loading = false;
            }).catch(function(error) {
                console.error('Error loading recent activity:', error);
                $scope.widgets.recentActivity.loading = false;
            });
        });
    };
    
    function getActivityIcon(action) {
        var icons = {
            'create': 'add_circle',
            'update': 'edit',
            'delete': 'delete',
            'login': 'login',
            'logout': 'logout',
            'approve': 'check_circle',
            'reject': 'cancel',
            'export': 'file_download'
        };
        
        return icons[action.toLowerCase()] || 'info';
    }
    
    $scope.personnelQuerySearch = function(text) {
        var deferred = $q.defer();
        if (!text || text.length < 2) {
            deferred.resolve([]);
            return deferred.promise;
        }
        
        $ocLazyLoad.load('js/services/StaffService.js').then(function() {
            var Staffs = $injector.get('Staff');
            Staffs.search({text: text}).then(function(response) {
                var result = response.data || [];
                $scope.searchResults = result;
                deferred.resolve(result);
            }).catch(function(error) {
                console.error('Error searching personnel:', error);
                deferred.resolve([]);
            });
        });
        return deferred.promise;
    };
    
    $scope.selectPersonnel = function(personnel) {
        $scope.personnelSelected = personnel;
        
        $mdDialog.show({
            controller: ['$scope', '$mdDialog', 'personnel', function($scope, $mdDialog, personnel) {
                $scope.personnel = personnel;
                
                $scope.close = function() {
                    $mdDialog.hide();
                };
            }],
            templateUrl: 'templates/dashboard/dialogs/personnel-details.html',
            parent: angular.element(document.body),
            clickOutsideToClose: true,
            locals: {
                personnel: personnel
            }
        });
    };
    
    $scope.showFilterDialog = function() {
        $mdDialog.show({
            controller: ['$scope', '$mdDialog', 'filters', function($scope, $mdDialog, filters) {
                $scope.filters = angular.copy(filters);
                
                $scope.cancel = function() {
                    $mdDialog.cancel();
                };
                
                $scope.apply = function() {
                    $mdDialog.hide($scope.filters);
                };
            }],
            templateUrl: 'templates/dashboard/dialogs/filter-dialog.html',
            parent: angular.element(document.body),
            clickOutsideToClose: true,
            locals: {
                filters: $scope.filters
            }
        }).then(function(updatedFilters) {
            $scope.filters = updatedFilters;
            $scope.loadDashboard();
        });
    };
    
    $scope.exportChart = function(chartId, title) {
        var canvas = document.getElementById(chartId);
        if (canvas) {
            var image = canvas.toDataURL('image/png');
            
            var link = document.createElement('a');
            link.download = title + '.png';
            link.href = image;
            link.click();
        }
    };
    
    $scope.refreshStats = function() {
        $scope.loadPersonnelStats();
    };
    
    $scope.refreshCharts = function() {
        $scope.loadChartData();
    };
    
    $scope.refreshActivity = function() {
        $scope.loadRecentActivity();
    };
    
    // Initialize dashboard
    $scope.loadDashboard();
});
