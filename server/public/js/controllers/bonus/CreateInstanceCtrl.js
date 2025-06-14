angular.module('CreateInstanceCtrl', []).controller('CreateInstanceController', function ($scope, $http, $mdDialog, toastr, templates) {
    $scope.templates = templates;
    $scope.instance = {
        templateId: '',
        referencePeriod: '',
        notes: ''
    };

    $scope.save = function() {
        if (!$scope.instance.templateId || !$scope.instance.referencePeriod) {
            toastr.error('Please fill in all required fields');
            return;
        }

        $http.post('/api/bonus/instances', $scope.instance)
            .then(function(response) {
                $mdDialog.hide(response.data);
            })
            .catch(function(error) {
                toastr.error('Failed to create bonus instance');
            });
    };

    $scope.cancel = function() {
        $mdDialog.cancel();
    };
});
