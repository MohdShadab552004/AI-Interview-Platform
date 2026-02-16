
export const LANGUAGE_OPTIONS = [
    {
        id: 63, // Judge0 ID for JavaScript (Node.js 12.14.0)
        name: "JavaScript",
        value: "javascript",
        boilerplate: `// Write your JavaScript code here
function solution() {
  console.log("Hello from JavaScript!");
}

solution();
`
    },
    {
        id: 71, // Judge0 ID for Python (3.8.1)
        name: "Python",
        value: "python",
        boilerplate: `# Write your Python code here
def solution():
    print("Hello from Python!")

if __name__ == "__main__":
    solution()
`
    },
    {
        id: 62, // Judge0 ID for Java (OpenJDK 13.0.1)
        name: "Java",
        value: "java",
        boilerplate: `// Write your Java code here
public class Main {
    public static void main(String[] args) {
        System.out.println("Hello from Java!");
    }
}
`
    },
    {
        id: 54, // Judge0 ID for C++ (GCC 9.2.0)
        name: "C++",
        value: "cpp",
        boilerplate: `// Write your C++ code here
#include <iostream>

int main() {
    std::cout << "Hello from C++!" << std::endl;
    return 0;
}
`
    },
    {
        id: 50, // Judge0 ID for C (GCC 9.2.0)
        name: "C",
        value: "c",
        boilerplate: `// Write your C code here
#include <stdio.h>

int main() {
    printf("Hello from C!\\n");
    return 0;
}
`
    }
];

export const getLanguageByValue = (value) => {
    return LANGUAGE_OPTIONS.find(lang => lang.value === value) || LANGUAGE_OPTIONS[0];
};

export const getLanguageById = (id) => {
    return LANGUAGE_OPTIONS.find(lang => lang.id === id) || LANGUAGE_OPTIONS[0];
};
