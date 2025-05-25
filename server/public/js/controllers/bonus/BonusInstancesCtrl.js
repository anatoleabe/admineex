app.controller('BonusInstancesCtrl', ['$scope', '$http', '$state', 'BonusService', '$mdDialog', '$mdToast', 
function($scope, $http, $state, BonusService, $mdDialog, $mdToast) {
    $scope.instances = [];
    $scope.loading = true;
    $scope.filters = {
        status: '',
        templateId: '',
        search: '',
        dateFrom: null,
        dateTo: null
    };
    
    $scope.statuses = [
        { id: 'draft', name: 'Brouillon' },
        { id: 'pending_approval', name: 'En attente d\'approbation' },
        { id: 'approved', name: 'Approuvé' },
        { id: 'rejected', name: 'Rejeté' },
        { id: 'paid', name: 'Payé' }
    ];
    
    $scope.templates = [];
    
    $scope.loadTemplates = function() {
        BonusService.getTemplates({ activeOnly: true }).then(function(response) {
            $scope.templates = response.data;
        });
    };
    
    $scope.loadInstances = function() {
        $scope.loading = true;
        BonusService.getInstances($scope.filters).then(function(response) {
            $scope.instances = response.data;
            $scope.loading = false;
        }).catch(function(error) {
            $scope.loading = false;
            $mdToast.show(
                $mdToast.simple()
                    .textContent('Erreur lors du chargement des instances de prime')
                    .position('top right')
                    .hideDelay(3000)
            );
        });
    };
    
    $scope.viewInstance = function(instance) {
        $state.go('home.bonus.instances.view', { id: instance._id });
    };
    
    $scope.generateBonus = function(ev) {
        $mdDialog.show({
            controller: 'BonusGenerationCtrl',
            templateUrl: 'templates/bonus/generation/dialog.html',
            parent: angular.element(document.body),
            targetEvent: ev,
            clickOutsideToClose: false,
            fullscreen: true
        }).then(function(result) {
            if (result && result.success) {
                $scope.loadInstances();
                $mdToast.show(
                    $mdToast.simple()
                        .textContent('Prime générée avec succès')
                        .position('top right')
                        .hideDelay(3000)
                );
            }
        });
    };
    
    $scope.approveInstance = function(ev, instance) {
        $mdDialog.show({
            controller: 'BonusApprovalCtrl',
            templateUrl: 'templates/bonus/instances/approval-dialog.html',
            parent: angular.element(document.body),
            targetEvent: ev,
            clickOutsideToClose: false,
            locals: {
                instance: instance,
                action: 'approve'
            }
        }).then(function(result) {
            if (result && result.success) {
                $scope.loadInstances();
                $mdToast.show(
                    $mdToast.simple()
                        .textContent('Prime approuvée avec succès')
                        .position('top right')
                        .hideDelay(3000)
                );
            }
        });
    };
    
    $scope.rejectInstance = function(ev, instance) {
        $mdDialog.show({
            controller: 'BonusApprovalCtrl',
            templateUrl: 'templates/bonus/instances/approval-dialog.html',
            parent: angular.element(document.body),
            targetEvent: ev,
            clickOutsideToClose: false,
            locals: {
                instance: instance,
                action: 'reject'
            }
        }).then(function(result) {
            if (result && result.success) {
                $scope.loadInstances();
                $mdToast.show(
                    $mdToast.simple()
                        .textContent('Prime rejetée')
                        .position('top right')
                        .hideDelay(3000)
                );
            }
        });
    };
    
    $scope.generatePaymentFile = function(ev, instance, format) {
        $scope.loading = true;
        BonusService.generatePaymentFile(instance._id, format).then(function(response) {
            $scope.loading = false;
            
            var blob;
            if (format === 'pdf') {
                blob = new Blob([response.data], { type: 'application/pdf' });
            } else {
                blob = new Blob([response.data], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
            }
            
            var link = document.createElement('a');
            link.href = window.URL.createObjectURL(blob);
            link.download = 'payment_' + instance._id + '.' + format;
            link.click();
            
            $mdToast.show(
                $mdToast.simple()
                    .textContent('Fichier de paiement généré avec succès')
                    .position('top right')
                    .hideDelay(3000)
            );
        }).catch(function(error) {
            $scope.loading = false;
            $mdToast.show(
                $mdToast.simple()
                    .textContent('Erreur lors de la génération du fichier de paiement')
                    .position('top right')
                    .hideDelay(3000)
            );
        });
    };
    
    $scope.getStatusName = function(statusId) {
        var status = $scope.statuses.find(function(s) {
            return s.id === statusId;
        });
        return status ? status.name : statusId;
    };
    
    $scope.getTemplateName = function(templateId) {
        var template = $scope.templates.find(function(t) {
            return t._id === templateId;
        });
        return template ? template.name : templateId;
    };
    
    $scope.filterByStatus = function(status) {
        $scope.filters.status = status;
        $scope.loadInstances();
    };
    
    $scope.filterByTemplate = function(templateId) {
        $scope.filters.templateId = templateId;
        $scope.loadInstances();
    };
    
    $scope.clearFilters = function() {
        $scope.filters = {
            status: '',
            templateId: '',
            search: '',
            dateFrom: null,
            dateTo: null
        };
        $scope.loadInstances();
    };
    
    $scope.canApprove = function(instance) {
        return instance.status === 'pending_approval';
    };
    
    $scope.canReject = function(instance) {
        return instance.status === 'pending_approval';
    };
    
    $scope.canGeneratePayment = function(instance) {
        return instance.status === 'approved';
    };
    
    $scope.loadTemplates();
    $scope.loadInstances();
}]);
