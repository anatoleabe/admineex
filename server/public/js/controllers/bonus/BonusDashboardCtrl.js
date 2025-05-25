app.controller('BonusDashboardCtrl', ['$scope', '$http', '$filter', 'BonusService', 
function($scope, $http, $filter, BonusService) {
    $scope.loading = true;
    $scope.stats = {
        summary: {},
        byStructure: [],
        byTemplate: [],
        byPeriod: [],
        byStatus: []
    };
    
    $scope.filters = {
        startDate: moment().startOf('year').toDate(),
        endDate: new Date(),
        structureId: '',
        templateId: ''
    };
    
    $scope.structures = [];
    $scope.templates = [];
    
    $scope.chartOptions = {
        responsive: true,
        maintainAspectRatio: false,
        legend: {
            display: true,
            position: 'bottom'
        },
        scales: {
            yAxes: [{
                ticks: {
                    beginAtZero: true
                }
            }]
        }
    };
    
    $scope.loadStructures = function() {
        $http.get('/api/structures').then(function(response) {
            $scope.structures = response.data;
        });
    };
    
    $scope.loadTemplates = function() {
        BonusService.getTemplates({ activeOnly: true }).then(function(response) {
            $scope.templates = response.data;
        });
    };
    
    $scope.loadDashboard = function() {
        $scope.loading = true;
        
        BonusService.getDashboardStats($scope.filters).then(function(response) {
            $scope.stats = response.data;
            $scope.loading = false;
            
            $scope.initCharts();
        }).catch(function(error) {
            $scope.loading = false;
            $scope.error = error.data && error.data.message ? 
                error.data.message : 'Erreur lors du chargement des statistiques';
        });
    };
    
    $scope.initCharts = function() {
        if ($scope.stats.byStructure && $scope.stats.byStructure.length > 0) {
            var structureCtx = document.getElementById('structureChart').getContext('2d');
            var structureLabels = $scope.stats.byStructure.map(function(item) {
                return item.structure ? item.structure.name : 'N/A';
            });
            var structureData = $scope.stats.byStructure.map(function(item) {
                return item.totalAmount;
            });
            
            new Chart(structureCtx, {
                type: 'bar',
                data: {
                    labels: structureLabels,
                    datasets: [{
                        label: 'Montant total des primes (FCFA)',
                        data: structureData,
                        backgroundColor: 'rgba(54, 162, 235, 0.6)',
                        borderColor: 'rgba(54, 162, 235, 1)',
                        borderWidth: 1
                    }]
                },
                options: $scope.chartOptions
            });
        }
        
        if ($scope.stats.byTemplate && $scope.stats.byTemplate.length > 0) {
            var templateCtx = document.getElementById('templateChart').getContext('2d');
            var templateLabels = $scope.stats.byTemplate.map(function(item) {
                return item.template ? item.template.name : 'N/A';
            });
            var templateData = $scope.stats.byTemplate.map(function(item) {
                return item.totalAmount;
            });
            
            new Chart(templateCtx, {
                type: 'pie',
                data: {
                    labels: templateLabels,
                    datasets: [{
                        data: templateData,
                        backgroundColor: [
                            'rgba(255, 99, 132, 0.6)',
                            'rgba(54, 162, 235, 0.6)',
                            'rgba(255, 206, 86, 0.6)',
                            'rgba(75, 192, 192, 0.6)',
                            'rgba(153, 102, 255, 0.6)',
                            'rgba(255, 159, 64, 0.6)',
                            'rgba(199, 199, 199, 0.6)'
                        ],
                        borderColor: [
                            'rgba(255, 99, 132, 1)',
                            'rgba(54, 162, 235, 1)',
                            'rgba(255, 206, 86, 1)',
                            'rgba(75, 192, 192, 1)',
                            'rgba(153, 102, 255, 1)',
                            'rgba(255, 159, 64, 1)',
                            'rgba(199, 199, 199, 1)'
                        ],
                        borderWidth: 1
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    legend: {
                        display: true,
                        position: 'bottom'
                    }
                }
            });
        }
        
        if ($scope.stats.byPeriod && $scope.stats.byPeriod.length > 0) {
            var periodCtx = document.getElementById('periodChart').getContext('2d');
            var periodLabels = $scope.stats.byPeriod.map(function(item) {
                return moment(item.period).format('MMM YYYY');
            });
            var periodData = $scope.stats.byPeriod.map(function(item) {
                return item.totalAmount;
            });
            
            new Chart(periodCtx, {
                type: 'line',
                data: {
                    labels: periodLabels,
                    datasets: [{
                        label: 'Montant total des primes (FCFA)',
                        data: periodData,
                        backgroundColor: 'rgba(75, 192, 192, 0.2)',
                        borderColor: 'rgba(75, 192, 192, 1)',
                        borderWidth: 2,
                        fill: true,
                        tension: 0.4
                    }]
                },
                options: $scope.chartOptions
            });
        }
        
        if ($scope.stats.byStatus && $scope.stats.byStatus.length > 0) {
            var statusCtx = document.getElementById('statusChart').getContext('2d');
            var statusLabels = $scope.stats.byStatus.map(function(item) {
                switch(item.status) {
                    case 'draft': return 'Brouillon';
                    case 'pending': return 'En attente';
                    case 'approved': return 'Approuvé';
                    case 'rejected': return 'Rejeté';
                    default: return item.status;
                }
            });
            var statusData = $scope.stats.byStatus.map(function(item) {
                return item.count;
            });
            
            new Chart(statusCtx, {
                type: 'doughnut',
                data: {
                    labels: statusLabels,
                    datasets: [{
                        data: statusData,
                        backgroundColor: [
                            'rgba(255, 206, 86, 0.6)',
                            'rgba(54, 162, 235, 0.6)',
                            'rgba(75, 192, 192, 0.6)',
                            'rgba(255, 99, 132, 0.6)'
                        ],
                        borderColor: [
                            'rgba(255, 206, 86, 1)',
                            'rgba(54, 162, 235, 1)',
                            'rgba(75, 192, 192, 1)',
                            'rgba(255, 99, 132, 1)'
                        ],
                        borderWidth: 1
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    legend: {
                        display: true,
                        position: 'bottom'
                    }
                }
            });
        }
    };
    
    $scope.applyFilters = function() {
        $scope.loadDashboard();
    };
    
    $scope.resetFilters = function() {
        $scope.filters = {
            startDate: moment().startOf('year').toDate(),
            endDate: new Date(),
            structureId: '',
            templateId: ''
        };
        $scope.applyFilters();
    };
    
    $scope.exportToPDF = function() {
        BonusService.exportDashboard($scope.filters).then(function(response) {
            var blob = new Blob([response.data], { type: 'application/pdf' });
            
            var link = document.createElement('a');
            link.href = window.URL.createObjectURL(blob);
            link.download = 'tableau_de_bord_primes_' + moment().format('YYYY-MM-DD') + '.pdf';
            link.click();
        }).catch(function(error) {
            $scope.exportError = 'Erreur lors de l\'export du tableau de bord';
        });
    };
    
    $scope.loadStructures();
    $scope.loadTemplates();
    $scope.loadDashboard();
}]);
