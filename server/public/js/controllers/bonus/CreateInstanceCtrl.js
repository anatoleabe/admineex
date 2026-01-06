angular.module('CreateInstanceCtrl', []).controller('CreateInstanceController', function ($scope, $http, $mdDialog, toastr, templates, gettextCatalog) {
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
        if (!$scope.instance.templateId || !$scope.instance.referencePeriod) {
            toastr.error(t('Please fill in all required fields'));
            return;
        }

        $http.post('/api/bonus/instances', $scope.instance)
            .then(function(response) {
                $mdDialog.hide(response.data);
            })
            .catch(function(error) {
                toastr.error(t('Failed to create bonus instance'));
            });
    };

    $scope.cancel = function() {
        $mdDialog.cancel();
    };
});
