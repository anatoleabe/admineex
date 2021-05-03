angular.module('Procras6Directive', []).directive('procras6', function (gettextCatalog, $ocLazyLoad, $injector, $rootScope) {
    return {
        restrict: 'AE',
        scope: {
            task: '=',
            status: '='
        },
        replace: true,
        templateUrl: 'templates/statistics/procrastinate/directives/procras6.html',
        link: function ($scope, $element, $attrs, scope) {
            $scope.loadingChart = true;
            $ocLazyLoad.load('js/services/TaskService.js').then(function () {
                var Task = $injector.get('Task');

                $scope.colors = [{
                        backgroundColor: 'rgba(133, 187, 101, 1)',
                        pointBackgroundColor: 'rgba(133, 187, 101, 1)',
                        pointHoverBackgroundColor: 'rgba(133, 187, 101, 1)',
                        borderColor: 'rgba(133, 187, 101, 1)',
                        pointBorderColor: '#fff',
                        pointHoverBorderColor: 'rgba(133, 187, 101, 1)'
                    }];
                $scope.options = {
                    tooltips: {
                        callbacks: {
                            label: function (tooltipItem, data) {
                                return data.datasets[tooltipItem.datasetIndex].data[tooltipItem.index] + ' Tasks';
                            }
                        }
                    },
                    scales: {
                        yAxes: [{
                                scaleLabel: {
                                    display: true,
                                    labelString: gettextCatalog.getString('Tasks')
                                },
                                gridLines: {
                                    display: false
                                }
                            }],
                        xAxes: [{
                                gridLines: {
                                    display: false
                                }
                            }]
                    }
                };
                function build() {
                    $scope.loadingChart = false;
                    var params = {

                    };
                    $scope.data = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
                    $scope.labels = ["Jan.", "Fev.", "Mars", "Avril.", "Mai", "Juin", "Juil.", "Aou.", "Sept.", "Oct.", "Nov.", "Dec."];
                    $scope.loadingChart = false;
                }

                build();
            });
        }
    };
});
