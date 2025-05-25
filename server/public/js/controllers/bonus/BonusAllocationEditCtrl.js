app.controller('BonusAllocationEditCtrl', ['$scope', '$http', '$mdDialog', 'BonusService', 'instanceId', 'allocation', 'template',
function($scope, $http, $mdDialog, BonusService, instanceId, allocation, template) {
    $scope.allocation = angular.copy(allocation);
    $scope.template = template;
    $scope.loading = false;
    
    $scope.updateAllocation = function() {
        $scope.loading = true;
        
        var updateData = {
            amount: $scope.allocation.amount
        };
        
        if (template.category === 'with_parts') {
            updateData.parts = $scope.allocation.parts;
        }
        
        BonusService.updateAllocation(instanceId, allocation._id, updateData).then(function(response) {
            $scope.loading = false;
            $mdDialog.hide({ success: true });
        }).catch(function(error) {
            $scope.loading = false;
            $scope.error = error.data && error.data.message ? error.data.message : 'Erreur lors de la mise à jour de l\'allocation';
        });
    };
    
    $scope.cancel = function() {
        $mdDialog.cancel();
    };
}]);
