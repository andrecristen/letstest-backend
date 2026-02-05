export const features = {
    isSelfHosted: process.env.SELF_HOSTED === "true",
    billingEnabled: process.env.DISABLE_BILLING !== "true",
    maxOrganizations: process.env.SELF_HOSTED === "true" ? 1 : undefined,
};
