app.controller('BonusInstanceCtrl', ['$scope', '$http', '$state', 'BonusService', '$mdDialog', '$mdToast', '$stateParams',
function($scope, $http, $state, BonusService, $mdDialog, $mdToast, $stateParams) {
    $scope.instance = null;
    $scope.allocations = [];
    $scope.loading = true;
    $scope.template = null;
    $scope.approvalSteps = [];
    $scope.currentUserCanApprove = false;
    
    $scope.allocationFilters = {
        search: '',
        structure: '',
        status: ''
    };
    
    $scope.statuses = [
        { id: 'draft', name: 'Brouillon' },
        { id: 'pending_approval', name: 'En attente d\'approbation' },
        { id: 'approved', name: 'Approuvé' },
        { id: 'rejected', name: 'Rejeté' },
        { id: 'paid', name: 'Payé' }
    ];
    
    $scope.loadInstance = function() {
        $scope.loading = true;
        BonusService.getInstance($stateParams.id).then(function(response) {
            $scope.instance = response.data;
            
            BonusService.getTemplate($scope.instance.templateId).then(function(templateResponse) {
                $scope.template = templateResponse.data;
                
                $scope.processApprovalWorkflow();
                
                $scope.loadAllocations();
            });
        }).catch(function(error) {
            $scope.loading = false;
            $mdToast.show(
                $mdToast.simple()
                    .textContent('Erreur lors du chargement de l\'instance de prime')
                    .position('top right')
                    .hideDelay(3000)
            );
            $state.go('home.bonus.instances.main');
        });
    };
    
    $scope.loadAllocations = function() {
        BonusService.getAllocations($stateParams.id, $scope.allocationFilters).then(function(response) {
            $scope.allocations = response.data;
            $scope.loading = false;
        }).catch(function(error) {
            $scope.loading = false;
            $mdToast.show(
                $mdToast.simple()
                    .textContent('Erreur lors du chargement des allocations')
                    .position('top right')
                    .hideDelay(3000)
            );
        });
    };
    
    $scope.processApprovalWorkflow = function() {
        if (!$scope.template || !$scope.instance) return;
        
        $scope.approvalSteps = [];
        var workflow = $scope.template.approvalWorkflow;
        
        if (workflow && workflow.steps) {
            workflow.steps.forEach(function(step, index) {
                var approvalStep = {
                    role: step.role,
                    required: step.required,
                    status: 'pending',
                    approver: null,
                    approvedAt: null,
                    comments: null
                };
                
                if ($scope.instance.approvals && $scope.instance.approvals.length > 0) {
                    var approval = $scope.instance.approvals.find(function(a) {
                        return a.role === step.role;
                    });
                    
                    if (approval) {
                        approvalStep.status = approval.approved ? 'approved' : 'rejected';
                        approvalStep.approver = approval.approver;
                        approvalStep.approvedAt = approval.approvedAt;
                        approvalStep.comments = approval.comments;
                    }
                }
                
                $scope.approvalSteps.push(approvalStep);
            });
        }
        
        $scope.currentUserCanApprove = $scope.instance.status === 'pending_approval';
    };
    
    $scope.approveInstance = function(ev) {
        $mdDialog.show({
            controller: 'BonusApprovalCtrl',
            templateUrl: 'templates/bonus/instances/approval-dialog.html',
            parent: angular.element(document.body),
            targetEvent: ev,
            clickOutsideToClose: false,
            locals: {
                instance: $scope.instance,
                action: 'approve'
            }
        }).then(function(result) {
            if (result && result.success) {
                $scope.loadInstance();
                $mdToast.show(
                    $mdToast.simple()
                        .textContent('Prime approuvée avec succès')
                        .position('top right')
                        .hideDelay(3000)
                );
            }
        });
    };
    
    $scope.rejectInstance = function(ev) {
        $mdDialog.show({
            controller: 'BonusApprovalCtrl',
            templateUrl: 'templates/bonus/instances/approval-dialog.html',
            parent: angular.element(document.body),
            targetEvent: ev,
            clickOutsideToClose: false,
            locals: {
                instance: $scope.instance,
                action: 'reject'
            }
        }).then(function(result) {
            if (result && result.success) {
                $scope.loadInstance();
                $mdToast.show(
                    $mdToast.simple()
                        .textContent('Prime rejetée')
                        .position('top right')
                        .hideDelay(3000)
                );
            }
        });
    };
    
    $scope.editAllocation = function(ev, allocation) {
        $mdDialog.show({
            controller: 'BonusAllocationEditCtrl',
            templateUrl: 'templates/bonus/allocations/edit-dialog.html',
            parent: angular.element(document.body),
            targetEvent: ev,
            clickOutsideToClose: false,
            locals: {
                instanceId: $stateParams.id,
                allocation: allocation,
                template: $scope.template
            }
        }).then(function(result) {
            if (result && result.success) {
                $scope.loadAllocations();
                $mdToast.show(
                    $mdToast.simple()
                        .textContent('Allocation mise à jour avec succès')
                        .position('top right')
                        .hideDelay(3000)
                );
            }
        });
    };
    
    $scope.generatePaymentFile = function(format) {
        $scope.loading = true;
        BonusService.generatePaymentFile($stateParams.id, format).then(function(response) {
            $scope.loading = false;
            
            var blob;
            if (format === 'pdf') {
                blob = new Blob([response.data], { type: 'application/pdf' });
            } else {
                blob = new Blob([response.data], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
            }
            
            var link = document.createElement('a');
            link.href = window.URL.createObjectURL(blob);
            link.download = 'payment_' + $stateParams.id + '.' + format;
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
    
    $scope.canApprove = function() {
        return $scope.instance && $scope.instance.status === 'pending_approval' && $scope.currentUserCanApprove;
    };
    
    $scope.canReject = function() {
        return $scope.instance && $scope.instance.status === 'pending_approval' && $scope.currentUserCanApprove;
    };
    
    $scope.canGeneratePayment = function() {
        return $scope.instance && $scope.instance.status === 'approved';
    };
    
    $scope.canEditAllocations = function() {
        return $scope.instance && $scope.instance.status === 'draft';
    };
    
    $scope.filterAllocations = function() {
        $scope.loadAllocations();
    };
    
    $scope.clearAllocationFilters = function() {
        $scope.allocationFilters = {
            search: '',
            structure: '',
            status: ''
        };
        $scope.loadAllocations();
    };
    
    $scope.goBack = function() {
        $state.go('home.bonus.instances.main');
    };
    
    $scope.loadInstance();
}]);
