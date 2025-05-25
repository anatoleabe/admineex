app.controller('BonusAuditCtrl', ['$scope', '$http', '$filter', 'BonusService', 
function($scope, $http, $filter, BonusService) {
    $scope.loading = true;
    $scope.auditLogs = [];
    $scope.totalItems = 0;
    $scope.currentPage = 1;
    $scope.itemsPerPage = 20;
    
    $scope.filters = {
        startDate: moment().subtract(30, 'days').toDate(),
        endDate: new Date(),
        entityType: '',
        action: '',
        userId: ''
    };
    
    $scope.entityTypes = [
        { value: 'template', label: 'Modèle de prime' },
        { value: 'instance', label: 'Instance de prime' },
        { value: 'allocation', label: 'Allocation de prime' }
    ];
    
    $scope.actionTypes = [
        { value: 'create', label: 'Création' },
        { value: 'update', label: 'Modification' },
        { value: 'delete', label: 'Suppression' },
        { value: 'approve', label: 'Approbation' },
        { value: 'reject', label: 'Rejet' },
        { value: 'generate', label: 'Génération' },
        { value: 'export', label: 'Export' }
    ];
    
    $scope.users = [];
    
    $scope.loadUsers = function() {
        $http.get('/api/users').then(function(response) {
            $scope.users = response.data;
        });
    };
    
    $scope.loadAuditLogs = function() {
        $scope.loading = true;
        
        var params = angular.copy($scope.filters);
        params.page = $scope.currentPage;
        params.limit = $scope.itemsPerPage;
        
        BonusService.getAuditLogs(params).then(function(response) {
            $scope.auditLogs = response.data.logs;
            $scope.totalItems = response.data.total;
            $scope.loading = false;
        }).catch(function(error) {
            $scope.loading = false;
            $scope.error = error.data && error.data.message ? 
                error.data.message : 'Erreur lors du chargement des journaux d\'audit';
        });
    };
    
    $scope.formatChanges = function(changes) {
        if (!changes || Object.keys(changes).length === 0) {
            return 'Aucun détail disponible';
        }
        
        var result = '';
        Object.keys(changes).forEach(function(key) {
            var oldValue = changes[key].old !== undefined ? JSON.stringify(changes[key].old) : 'N/A';
            var newValue = changes[key].new !== undefined ? JSON.stringify(changes[key].new) : 'N/A';
            
            result += '<strong>' + key + '</strong>: ' + oldValue + ' → ' + newValue + '<br>';
        });
        
        return result;
    };
    
    $scope.pageChanged = function() {
        $scope.loadAuditLogs();
    };
    
    $scope.applyFilters = function() {
        $scope.currentPage = 1;
        $scope.loadAuditLogs();
    };
    
    $scope.resetFilters = function() {
        $scope.filters = {
            startDate: moment().subtract(30, 'days').toDate(),
            endDate: new Date(),
            entityType: '',
            action: '',
            userId: ''
        };
        $scope.applyFilters();
    };
    
    $scope.exportToExcel = function() {
        var params = angular.copy($scope.filters);
        params.format = 'excel';
        
        BonusService.exportAuditLogs(params).then(function(response) {
            var blob = new Blob([response.data], { 
                type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' 
            });
            
            var link = document.createElement('a');
            link.href = window.URL.createObjectURL(blob);
            link.download = 'audit_logs_' + moment().format('YYYY-MM-DD') + '.xlsx';
            link.click();
        }).catch(function(error) {
            $scope.exportError = 'Erreur lors de l\'export des journaux d\'audit';
        });
    };
    
    $scope.loadUsers();
    $scope.loadAuditLogs();
}]);
