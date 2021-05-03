angular.module('Procras7Directive', []).directive('procras7', function (gettextCatalog, $ocLazyLoad, $injector, $rootScope) {
    return {
        restrict: 'AE',
        scope: {
            task: '=',
            status: '='
        },
        replace: true,
        templateUrl: 'templates/statistics/procrastinate/directives/procras7.html',
        link: function ($scope, $element, $attrs, scope) {
            $scope.loadingChart = true;
            $ocLazyLoad.load('js/services/TaskService.js').then(function () {
                var Task = $injector.get('Task');

                $scope.colors = ["#0277BD"];
                $scope.options = {
                    legend: {
                        display: false,
                        position: 'right'
                    },
                    scales: {
                        yAxes: [{
                                scaleLabel: {
                                    display: true,
                                    labelString: gettextCatalog.getString('Nb of tasks')
                                },
                                gridLines: {
                                    display: true
                                }
                            }],
                        xAxes: [{
                                scaleLabel: {
                                    display: true,
                                    labelString: gettextCatalog.getString('Month')
                                },
                                gridLines: {
                                    display: false
                                }
                            }]
                    }
                };
                $scope.data = [
                    [0, 10, 17, 20, 5, 8, 32, 26, 32, 13, 54, 60],
                    [1, 2, 3, 50, 5, 6, 7, 4, 9, 10, 68, 12]
                ];
                $scope.labels = ["Jan.", "Fev.", "Mars", "Avril.", "Mai", "Juin", "Juil.", "Aou.", "Sept.", "Oct.", "Nov.", "Dec."];
                $scope.loadingChart = false;
                build();
            });
        }
    };
});
