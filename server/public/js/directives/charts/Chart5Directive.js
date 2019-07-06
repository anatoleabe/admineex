angular.module('Chart5Directive', []).directive('chart5', function(gettextCatalog, $ocLazyLoad, $injector, $rootScope) {
    return {
        restrict: 'A',
        scope: {},
        templateUrl: 'templates/dashboard/directives/chart5.html',
        link: function ($scope, $element, $attrs) {
            $scope.loadingChart = true;
            $ocLazyLoad.load('js/services/ChartService.js').then(function () {
                var Chart = $injector.get('Chart');

                function build() {
                    $scope.loadingChart = true;
//                    Chart.build({
//                        name : 'chart1',
//                    }).then(function(response){
//                        var data = response.data;
//                        $scope.loadingChart = false;
//                        //$scope.data = data.data;
//                        $scope.data = [300, 500];
//                    }).catch(function(response) {
//                        $rootScope.kernel.alerts.push({
//                            type: 1,
//                            msg: gettextCatalog.getString('An error occurred, please try again later'),
//                            priority: 2
//                        });
//                    });
                    $scope.loadingChart = false;
                    //$scope.data = data.data;
                    $scope.data = [2000, 700, 406, 101, 201];
                }
                build();
            });
        }
    };
});
