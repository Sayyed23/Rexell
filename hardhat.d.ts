import "hardhat/types/runtime";
import { ethers } from "ethers";

declare module "hardhat/types/runtime" {
  export interface HardhatRuntimeEnvironment {
    ethers: typeof ethers;
  }
}