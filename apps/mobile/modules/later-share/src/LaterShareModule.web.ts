import { registerWebModule, NativeModule } from 'expo';

// LaterShareModule is not available on the web platform.
class LaterShareModule extends NativeModule {}

export default registerWebModule(LaterShareModule, 'LaterShareModule');
