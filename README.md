# Solomon Sale Contract

A sale contract for ERC20 tokens to facilitate the Solomon Presale and any future ETH -> SLM sales.

### Definitions
- **ETH** - The native cryptocurrency of the Ethereum platform
- **SLM** - The Solomon Token, an ERC20 compatible Ethereum token
- **contract** - A smart contract on the Ethereum platform

### Description

The sale contract allows the owner to set an exchange rate of ETH to some quantity of tokens. For example, if `exchangeRate` is 300, 300 SLM
will be provided for every ETH sent to the contract. The contract is intended for SLM tokens, but may be used with any ERC20 compatible token.

The owner can set a minimum and maximum ETH amount, pause and unpause the contract, and change the exchange rate at any time. The contract needs tokens
to function, and can be initialized/refilled by sending it tokens with a standard ERC20 tranfer. If the maximum amount is set to 0,
unlimited ETH may be converted.

### Features
- Automatically convert ETH to tokens
- Pause and unpause
- Minimum and maximum ETH exchange amount
- Set exchange rate
- Handle low funds gracefully

### Deploy

1. Deploy an ERC20 token. The resulting contract address is referred to below as TokenAddress
2. Compile and deploy SolomonSale with initial parameters:
    a. `token`: TokenAddress
    b. `initialExchangeRate`: The initial ETH to Token conversion rate
    c. `minExchange`: The minimum amount per exchange, in wei
    d. `maxExchange`: The maximum contribution amount per wallet, in wei
