angular.module('SedentaryCtrl', []).controller('SedentaryController', function ($scope, $window, $mdDialog, $q, gettextCatalog, $stateParams, $state, $ocLazyLoad, $injector, $rootScope, $location, params) {
    //$rootScope.kernel.loading = 0;
    $scope.title = "...";
    $scope.params = params;
    $scope.sedentaries = params.details;
    $scope.query = {
        limit: 50,
        page: 1,
        order: "name"
    };
    
    
    $scope.close = function () {
        $mdDialog.hide();
    }
    $scope.cancel = function () {
        $mdDialog.cancel();
    };


});
