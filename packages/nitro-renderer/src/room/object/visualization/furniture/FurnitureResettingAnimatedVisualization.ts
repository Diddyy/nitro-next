import { AnimatedFurnitureVisualization } from './AnimatedFurnitureVisualization';

export class FurnitureResettingAnimatedVisualization extends AnimatedFurnitureVisualization {
    protected override usesAnimationResetting(): boolean {
        return true;
    }
}
