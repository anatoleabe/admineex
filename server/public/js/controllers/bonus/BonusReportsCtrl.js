app.controller('BonusReportsCtrl', ['$scope', '$http', '$filter', 'BonusService', 
function($scope, $http, $filter, BonusService) {
    $scope.loading = true;
    $scope.reports = {
        byStructure: {
            data: [],
            loading: false
        },
        byPeriod: {
            data: [],
            loading: false
        },
        byTemplate: {
            data: [],
            loading: false
        }
    };
    
    $scope.filters = {
        startDate: new Date(new Date().getFullYear(), 0, 1), // January 1st of current year
        endDate: new Date(),
        structureId: '',
        templateId: ''
    };
    
    $scope.structures = [];
    $scope.templates = [];
    
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
    
    $scope.loadReports = function() {
        $scope.loading = true;
        
        $scope.reports.byStructure.loading = true;
        BonusService.getReportByStructure($scope.filters).then(function(response) {
            $scope.reports.byStructure.data = response.data;
            $scope.reports.byStructure.loading = false;
            checkAllLoaded();
        }).catch(function(error) {
            $scope.reports.byStructure.loading = false;
            $scope.reports.byStructure.error = error.data && error.data.message ? 
                error.data.message : 'Erreur lors du chargement du rapport par structure';
            checkAllLoaded();
        });
        
        $scope.reports.byPeriod.loading = true;
        BonusService.getReportByPeriod($scope.filters).then(function(response) {
            $scope.reports.byPeriod.data = response.data;
            $scope.reports.byPeriod.loading = false;
            checkAllLoaded();
        }).catch(function(error) {
            $scope.reports.byPeriod.loading = false;
            $scope.reports.byPeriod.error = error.data && error.data.message ? 
                error.data.message : 'Erreur lors du chargement du rapport par période';
            checkAllLoaded();
        });
        
        $scope.reports.byTemplate.loading = true;
        BonusService.getReportByTemplate($scope.filters).then(function(response) {
            $scope.reports.byTemplate.data = response.data;
            $scope.reports.byTemplate.loading = false;
            checkAllLoaded();
        }).catch(function(error) {
            $scope.reports.byTemplate.loading = false;
            $scope.reports.byTemplate.error = error.data && error.data.message ? 
                error.data.message : 'Erreur lors du chargement du rapport par modèle';
            checkAllLoaded();
        });
    };
    
    function checkAllLoaded() {
        if (!$scope.reports.byStructure.loading && 
            !$scope.reports.byPeriod.loading && 
            !$scope.reports.byTemplate.loading) {
            $scope.loading = false;
        }
    }
    
    $scope.exportToExcel = function(reportType) {
        var reportData = $scope.reports[reportType].data;
        var title = '';
        
        switch(reportType) {
            case 'byStructure':
                title = 'Rapport des primes par structure';
                break;
            case 'byPeriod':
                title = 'Rapport des primes par période';
                break;
            case 'byTemplate':
                title = 'Rapport des primes par modèle';
                break;
        }
        
        var content = {
            title: title,
            headers: getHeadersForReport(reportType),
            rows: getRowsForReport(reportType, reportData)
        };
        
        BonusService.exportReport(content).then(function(response) {
        }).catch(function(error) {
            $scope.exportError = error.data && error.data.message ? 
                error.data.message : 'Erreur lors de l\'export du rapport';
        });
    };
    
    function getHeadersForReport(reportType) {
        switch(reportType) {
            case 'byStructure':
                return ['Structure', 'Nombre de primes', 'Montant total', 'Nombre de bénéficiaires'];
            case 'byPeriod':
                return ['Période', 'Nombre de primes', 'Montant total', 'Nombre de bénéficiaires'];
            case 'byTemplate':
                return ['Modèle de prime', 'Nombre de primes', 'Montant total', 'Nombre de bénéficiaires'];
            default:
                return [];
        }
    }
    
    function getRowsForReport(reportType, data) {
        var rows = [];
        
        if (!data || !data.length) {
            return rows;
        }
        
        switch(reportType) {
            case 'byStructure':
                data.forEach(function(item) {
                    rows.push([
                        item.structure ? item.structure.name : 'N/A',
                        item.count,
                        $filter('currency')(item.totalAmount, 'FCFA ', 0),
                        item.beneficiaryCount
                    ]);
                });
                break;
                
            case 'byPeriod':
                data.forEach(function(item) {
                    rows.push([
                        $filter('date')(item.period, 'MMMM yyyy'),
                        item.count,
                        $filter('currency')(item.totalAmount, 'FCFA ', 0),
                        item.beneficiaryCount
                    ]);
                });
                break;
                
            case 'byTemplate':
                data.forEach(function(item) {
                    rows.push([
                        item.template ? item.template.name : 'N/A',
                        item.count,
                        $filter('currency')(item.totalAmount, 'FCFA ', 0),
                        item.beneficiaryCount
                    ]);
                });
                break;
        }
        
        return rows;
    }
    
    $scope.exportToPDF = function(reportType) {
        var reportData = $scope.reports[reportType].data;
        var title = '';
        
        switch(reportType) {
            case 'byStructure':
                title = 'Rapport des primes par structure';
                break;
            case 'byPeriod':
                title = 'Rapport des primes par période';
                break;
            case 'byTemplate':
                title = 'Rapport des primes par modèle';
                break;
        }
        
        var content = {
            title: title,
            headers: getHeadersForReport(reportType),
            rows: getRowsForReport(reportType, reportData),
            format: 'pdf'
        };
        
        BonusService.exportReport(content).then(function(response) {
        }).catch(function(error) {
            $scope.exportError = error.data && error.data.message ? 
                error.data.message : 'Erreur lors de l\'export du rapport';
        });
    };
    
    $scope.loadStructures();
    $scope.loadTemplates();
    $scope.loadReports();
}]);
