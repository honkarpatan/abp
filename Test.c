#include <stdio.h>

int main() {
    float a, b, result;

    printf("Enter your First number: ");
    fflush(stdout);
    scanf("%f", &a);

    printf("Enter your Second number: ");
    fflush(stdout);
    scanf("%f", &b);

    result = a + b;

    printf("Result: %f\n", result);

    return 0;
}
