angular.module('Card4Directive', [[
    'node_modules/angular-material-data-table/dist/md-data-table.min.css'
]]).directive('card4', function (gettextCatalog, $ocLazyLoad, $injector, $rootScope) {
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
                        name : 'card4'
                    }).then(function (response) {
                        $scope.loadingChart = false;
                        $scope.statistics = response.data;
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
