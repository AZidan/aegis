export const manifestTemplate = (name: string) => `{
  "name": "${name}",
  "version": "1.0.0",
  "description": "TODO: Describe your skill",
  "category": "custom",
  "compatibleRoles": ["engineering"],
  "permissions": {
    "network": { "allowedDomains": [] },
    "files": { "readPaths": [], "writePaths": [] },
    "env": { "required": [], "optional": [] }
  }
}
`;
