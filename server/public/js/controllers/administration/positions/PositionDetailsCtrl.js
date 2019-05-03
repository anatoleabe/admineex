angular.module('PositionDetailsCtrl', []).controller('PositionDetailsController', function ($scope, gettextCatalog, $stateParams, $state, $ocLazyLoad, $injector, $rootScope, $mdDialog, params) {
    $rootScope.kernel.loading = 0;
    var id = params && params.id ? params.id : $stateParams.id;
    $scope.params = params;
    $scope.title = "...";
    $scope.position = {

    }

    $scope.loading = false;
    $scope.sending = false;
    $scope.cities = [];
    $scope.states = [];
    $scope.position = {};
    
    

    $ocLazyLoad.load('js/services/PositionService.js').then(function () {
        var Position = $injector.get('Position');
        $rootScope.kernel.loading = 100;

        Position.read({id: id}).then(function (response) {
            var data = response.data;
            $scope.position = data;
        }).catch(function (response) {
            console.error(response);
        });

    });
});
