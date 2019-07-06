angular.module('Card4Directive', []).directive('card4', function (gettextCatalog, $ocLazyLoad, $injector, $rootScope) {
    return {
        restrict: 'A',
        scope: {},
        templateUrl: 'templates/statistics/directives/card4.html',
        link: function ($scope, $element, $attrs) {
            $scope.loadingChart = true;
            
            $ocLazyLoad.load('js/services/ChartService.js').then(function () {
                var Chart = $injector.get('Chart');
                function build() {
                    $scope.loadingChart = true;
                    Chart.build({
                        name : 'nonFonctionnaire'
                    }).then(function (response) {
                        $scope.loadingChart = false;
                        $scope.statistics = response.data.statistics;
                    }).catch(function (response) {
                        $rootScope.kernel.alerts.push({
                            type: 1,
                            msg: gettextCatalog.getString('An error occurred, please try again later'),
                            priority: 2
                        });
                    });
                }
                build();
            });
        }
    };
});
