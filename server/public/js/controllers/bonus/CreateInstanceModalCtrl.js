angular.module('app').controller('CreateInstanceModalCtrl', [
    '$scope',
    '$http',
    'toastr',
    '$uibModalInstance',
    'templates',
    function($scope, $http, toastr, $uibModalInstance, templates) {
        $scope.templates = templates;
        $scope.instance = {
            templateId: '',
            referencePeriod: '',
            notes: ''
        };

        $scope.save = function() {
            if ($scope.instanceForm.$invalid) {
                return;
            }

            $http.post('/api/bonus/instances', $scope.instance)
                .then(function(response) {
                    $uibModalInstance.close(response.data);
                })
                .catch(function(error) {
                    toastr.error('Failed to create bonus instance');
                });
        };

        $scope.cancel = function() {
            $uibModalInstance.dismiss('cancel');
        };
    }
]);
