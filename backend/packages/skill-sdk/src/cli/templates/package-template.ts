export const packageTemplate = (name: string) => `{
  "name": "${name}",
  "version": "1.0.0",
  "private": true,
  "main": "dist/skill.js",
  "scripts": {
    "build": "tsc",
    "test": "jest --verbose",
    "validate": "aegis-skill validate"
  },
  "dependencies": {
    "@aegis/skill-sdk": "^0.1.0"
  },
  "devDependencies": {
    "typescript": "^5.9.3",
    "jest": "^29.7.0",
    "ts-jest": "^29.2.0",
    "@types/jest": "^29.5.0"
  }
}
`;
