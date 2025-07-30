import { ClusterManagerOptions } from "discord-hybrid-sharding";

export const token = 'MTI1ODMxNjcyNTY5NTQxNDM0Mg.G05tib.-jfmc-sTOpvM4ZRhm2-AveBtsDh72u3G9JvsPA';

export const mongoUrl = 'mongodb+srv://leyt:QaU9yjBdtNgqTAcl@leytdev.4xni7.mongodb.net/economy?retryWrites=true&w=majority&appName=leytDev';

export const ownerUID = '508607847416725565'

export const clientId = '1258316725695414342';
export const guildId = '1266364172116168767';

export const owners = [
  { id: '' }
];

export const cluster: ClusterManagerOptions = {
  totalShards: 1,
  shardsPerClusters: 1,
  token: token
};
