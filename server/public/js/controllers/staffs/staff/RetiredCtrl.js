angular.module('RetiredCtrl', []).controller('RetiredController', function ($scope, $window, $mdDialog, $q, gettextCatalog, $stateParams, $state, $ocLazyLoad, $injector, $rootScope, $location, params) {
    //$rootScope.kernel.loading = 0;
    $scope.title = "...";
    $scope.params = params;

    $scope.query = {
        limit: 50,
        page: 1,
        order: "-retirement.notified"
    };

    $scope.helper = {
        title: gettextCatalog.getString("No correspondance retired found"),
    };


    $scope.close = function () {
        $mdDialog.hide();
    }
    $scope.cancel = function () {
        $mdDialog.cancel();
    };


    $ocLazyLoad.load('js/services/StaffService.js').then(function () {
        var Staffs = $injector.get('Staff');
        $scope.personnels = undefined;
        $scope.position = $scope.params.position;

        var deferred = $q.defer();

        Staffs.retired({}).then(function (response) {
            $scope.personnels = response.data;
            $rootScope.kernel.loading = 100;
            deferred.resolve($scope.personnels);
        }).catch(function (response) {
            console.log(response);
        });
        return deferred.promise;
    });
});
