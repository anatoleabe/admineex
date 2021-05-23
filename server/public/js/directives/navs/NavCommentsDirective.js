angular.module('NavCommentsDirective', []).directive('navcomments', function (gettextCatalog, $ocLazyLoad, $injector, $rootScope) {
    return {
        restrict: 'A',
        scope: {},
        templateUrl: 'templates/procrastinate/tasks/directives/navcomments.html',
        link: function ($scope, $element, $attrs) {
            $scope.loading = true;
            $scope.rows = 1;
            $scope.newcomment;


            $scope.task = {
                _id: $rootScope.selectedTaskId,
                comments:undefined
            };

            angular.element(document).ready(function () {
                $('#summernoteComment').summernote();
            });

            $ocLazyLoad.load('js/services/TaskService.js').then(function () {
                var Task = $injector.get('Task');

                $scope.loading = true;
                $scope.currentNavItem = "Histoire";
                $scope.commentActions = false;

                loadComments = function () {
                    Task.comments({
                        id: $rootScope.selectedTaskId
                    }).then(function (response) {
                        $scope.comments = response.data;
                        $scope.task.comments = response.data;
                    }).catch(function (response) {
                        console.log(response);
                        $rootScope.kernel.alerts.push({
                            type: 1,
                            msg: gettextCatalog.getString('An error occurred, please try again later'),
                            priority: 2
                        });
                    });
                };
                loadComments();


                // Add a new task
                $scope.deleteComment = function (cIndex) {
                    Task.deleteComments({
                        id: $rootScope.selectedTaskId,
                        cindex:cIndex
                    }).then(function (response) {
                        loadComments();
                    }).catch(function (response) {
                        console.log(response);
                        $rootScope.kernel.alerts.push({
                            type: 1,
                            msg: gettextCatalog.getString('An error occurred, please try again later'),
                            priority: 2
                        });
                    });
                }

                // Add a new task
                $scope.submit = function () {
                    $scope.loading = 0;
                    if ($scope.newcomment != undefined && $scope.newcomment != "") {
                        $scope.task.comment = {
                            comment: $scope.newcomment,
                            date: new Date(),
                            authorID: $rootScope.account.id
                        }
                        $rootScope.kernel.loading = 0;
                        Task.update($scope.task).then(function (response) {
                            $scope.newcomment = "";
                            loadComments();
                            $rootScope.kernel.loading = 100;
                            
                        }).catch(function (response) {
                            $rootScope.kernel.loading = 100;
                            $rootScope.kernel.alerts.push({
                                type: 1,
                                msg: gettextCatalog.getString('An error occurred, please try again later'),
                                priority: 2
                            });
                            console.error(response);
                        });
                    }
                }
            });
        }
    };
});
