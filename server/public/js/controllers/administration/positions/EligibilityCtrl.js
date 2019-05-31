angular.module('EligibilityCtrl', []).controller('EligibilityController', function ($scope, $window, $mdDialog, $q, gettextCatalog, $stateParams, $state, $ocLazyLoad, $injector, $rootScope, $location, params) {
    //$rootScope.kernel.loading = 0;
    $scope.title = "...";
    $scope.params = params;

    $scope.query = {
        limit: 50,
        page: 1,
        order: "-corresponding"
    };

    $scope.helper = {
        title: gettextCatalog.getString("No correspondance found for this position"),
        subtitle: gettextCatalog.getString("Vérifier que le profil et les compétences requis du poste ont été renségné ")
    };


    $scope.close = function () {
        $mdDialog.hide();
    }
    $scope.cancel = function () {
        $mdDialog.cancel();
    };


    $ocLazyLoad.load('js/services/StaffService.js').then(function () {
        var Staffs = $injector.get('Staff');

        $ocLazyLoad.load('js/services/PositionService.js').then(function () {
            var Position = $injector.get('Position');

            $scope.personnels = undefined;
            $scope.position = $scope.params.position;
            
            var deferred = $q.defer();
            
            Staffs.eligible({id: $scope.params.position._id}).then(function (response) {
                $scope.personnels = response.data;
                console.log($scope.personnels);
                deferred.resolve($scope.personnels);
            }).catch(function (response) {
                console.log(response);
            });
            return deferred.promise;
            
        });
    });
});
