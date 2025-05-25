app.controller('BonusApprovalCtrl', ['$scope', '$http', '$mdDialog', 'BonusService', 'instance', 'action',
function($scope, $http, $mdDialog, BonusService, instance, action) {
    $scope.instance = instance;
    $scope.action = action;
    $scope.loading = false;
    $scope.approvalData = {
        comments: ''
    };
    
    $scope.title = action === 'approve' ? 'Approuver la prime' : 'Rejeter la prime';
    $scope.buttonText = action === 'approve' ? 'Approuver' : 'Rejeter';
    
    $scope.submitApproval = function() {
        $scope.loading = true;
        
        var promise;
        if (action === 'approve') {
            promise = BonusService.approveInstance(instance._id, $scope.approvalData);
        } else {
            promise = BonusService.rejectInstance(instance._id, $scope.approvalData);
        }
        
        promise.then(function(response) {
            $scope.loading = false;
            $mdDialog.hide({ success: true });
        }).catch(function(error) {
            $scope.loading = false;
            $scope.error = error.data && error.data.message ? error.data.message : 'Erreur lors de l\'approbation/rejet de la prime';
        });
    };
    
    $scope.cancel = function() {
        $mdDialog.cancel();
    };
}]);
