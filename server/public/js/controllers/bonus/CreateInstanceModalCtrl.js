angular.module('app').controller('CreateInstanceModalCtrl', [
    '$scope',
    '$http',
    'toastr',
    '$uibModalInstance',
    'templates',
    'gettextCatalog',
    function($scope, $http, toastr, $uibModalInstance, templates, gettextCatalog) {
        function t(msgid) {
            return gettextCatalog.getString(msgid);
        }
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
                    toastr.error(t('Failed to create bonus instance'));
                });
        };

        $scope.cancel = function() {
            $uibModalInstance.dismiss('cancel');
        };
    }
]);
