import Utils from "../Utils";

const ChangeHistoryService = game.GetService("ChangeHistoryService");

const { getInstancePath, getInstanceByPath, convertPropertyValue } = Utils;

function createObject(requestData: Record<string, unknown>) {
	const className = requestData.className as string;
	const parentPath = requestData.parent as string;
	const name = requestData.name as string | undefined;
	const properties = (requestData.properties as Record<string, unknown>) ?? {};

	if (!className || !parentPath) {
		return { error: "Class name and parent are required" };
	}

	const parentInstance = getInstanceByPath(parentPath);
	if (!parentInstance) return { error: `Parent instance not found: ${parentPath}` };

	const [success, newInstance] = pcall(() => {
		const instance = new Instance(className as keyof CreatableInstances);
		if (name) instance.Name = name;

		for (const [propertyName, propertyValue] of pairs(properties)) {
			pcall(() => {
				(instance as unknown as { [key: string]: unknown })[propertyName as string] = propertyValue;
			});
		}

		instance.Parent = parentInstance;
		ChangeHistoryService.SetWaypoint(`Create ${className}`);
		return instance;
	});

	if (success && newInstance) {
		return {
			success: true,
			className,
			parent: parentPath,
			instancePath: getInstancePath(newInstance as Instance),
			name: (newInstance as Instance).Name,
			message: "Object created successfully",
		};
	} else {
		return { error: `Failed to create object: ${newInstance}`, className, parent: parentPath };
	}
}

function deleteObject(requestData: Record<string, unknown>) {
	const instancePath = requestData.instancePath as string;
	if (!instancePath) return { error: "Instance path is required" };

	const instance = getInstanceByPath(instancePath);
	if (!instance) return { error: `Instance not found: ${instancePath}` };
	if (instance === game) return { error: "Cannot delete the game instance" };

	const [success, result] = pcall(() => {
		const name = instance.Name;
		const className = instance.ClassName;
		instance.Destroy();
		ChangeHistoryService.SetWaypoint(`Delete ${className} (${name})`);
		return true;
	});

	if (success) {
		return { success: true, instancePath, message: "Object deleted successfully" };
	} else {
		return { error: `Failed to delete object: ${result}`, instancePath };
	}
}

function massCreateObjects(requestData: Record<string, unknown>) {
	const objects = requestData.objects as Record<string, unknown>[];
	if (!objects || !typeIs(objects, "table") || (objects as defined[]).size() === 0) {
		return { error: "Objects array is required" };
	}

	const results: Record<string, unknown>[] = [];
	let successCount = 0;
	let failureCount = 0;

	for (const objData of objects) {
		const className = objData.className as string;
		const parentPath = objData.parent as string;
		const name = objData.name as string | undefined;

		if (className && parentPath) {
			const parentInstance = getInstanceByPath(parentPath);
			if (parentInstance) {
				const [success, newInstance] = pcall(() => {
					const instance = new Instance(className as keyof CreatableInstances);
					if (name) instance.Name = name;
					instance.Parent = parentInstance;
					return instance;
				});

				if (success && newInstance) {
					successCount++;
					results.push({
						success: true, className, parent: parentPath,
						instancePath: getInstancePath(newInstance as Instance),
						name: (newInstance as Instance).Name,
					});
				} else {
					failureCount++;
					results.push({ success: false, className, parent: parentPath, error: tostring(newInstance) });
				}
			} else {
				failureCount++;
				results.push({ success: false, className, parent: parentPath, error: "Parent instance not found" });
			}
		} else {
			failureCount++;
			results.push({ success: false, error: "Class name and parent are required" });
		}
	}

	if (successCount > 0) ChangeHistoryService.SetWaypoint("Mass create objects");
	return { results, summary: { total: (objects as defined[]).size(), succeeded: successCount, failed: failureCount } };
}

function massCreateObjectsWithProperties(requestData: Record<string, unknown>) {
	const objects = requestData.objects as Record<string, unknown>[];
	if (!objects || !typeIs(objects, "table") || (objects as defined[]).size() === 0) {
		return { error: "Objects array is required" };
	}

	const results: Record<string, unknown>[] = [];
	let successCount = 0;
	let failureCount = 0;

	for (const objData of objects) {
		const className = objData.className as string;
		const parentPath = objData.parent as string;
		const name = objData.name as string | undefined;
		const properties = (objData.properties as Record<string, unknown>) ?? {};

		if (className && parentPath) {
			const parentInstance = getInstanceByPath(parentPath);
			if (parentInstance) {
				const [success, newInstance] = pcall(() => {
					const instance = new Instance(className as keyof CreatableInstances);
					if (name) instance.Name = name;
					instance.Parent = parentInstance;

					for (const [propName, propValue] of pairs(properties)) {
						pcall(() => {
							const converted = convertPropertyValue(instance, propName as string, propValue);
							if (converted !== undefined) {
								(instance as unknown as { [key: string]: unknown })[propName as string] = converted;
							}
						});
					}
					return instance;
				});

				if (success && newInstance) {
					successCount++;
					results.push({
						success: true, className, parent: parentPath,
						instancePath: getInstancePath(newInstance as Instance),
						name: (newInstance as Instance).Name,
					});
				} else {
					failureCount++;
					results.push({ success: false, className, parent: parentPath, error: tostring(newInstance) });
				}
			} else {
				failureCount++;
				results.push({ success: false, className, parent: parentPath, error: "Parent instance not found" });
			}
		} else {
			failureCount++;
			results.push({ success: false, error: "Class name and parent are required" });
		}
	}

	if (successCount > 0) ChangeHistoryService.SetWaypoint("Mass create objects with properties");
	return { results, summary: { total: (objects as defined[]).size(), succeeded: successCount, failed: failureCount } };
}

function smartDuplicate(requestData: Record<string, unknown>) {
	const instancePath = requestData.instancePath as string;
	const count = requestData.count as number;
	const options = (requestData.options as Record<string, unknown>) ?? {};

	if (!instancePath || !count || count < 1) {
		return { error: "Instance path and count > 0 are required" };
	}

	const instance = getInstanceByPath(instancePath);
	if (!instance) return { error: `Instance not found: ${instancePath}` };

	const results: Record<string, unknown>[] = [];
	let successCount = 0;
	let failureCount = 0;

	for (let i = 1; i <= count; i++) {
		const [success, newInstance] = pcall(() => {
			const clone = instance.Clone();

			if (options.namePattern) {
				clone.Name = (options.namePattern as string).gsub("{n}", tostring(i))[0];
			} else {
				clone.Name = instance.Name + i;
			}

			if (options.positionOffset && clone.IsA("BasePart")) {
				const offset = options.positionOffset as number[];
				const currentPos = clone.Position;
				clone.Position = new Vector3(
					currentPos.X + ((offset[0] ?? 0) as number) * i,
					currentPos.Y + ((offset[1] ?? 0) as number) * i,
					currentPos.Z + ((offset[2] ?? 0) as number) * i,
				);
			}

			if (options.rotationOffset && clone.IsA("BasePart")) {
				const offset = options.rotationOffset as number[];
				clone.CFrame = clone.CFrame.mul(CFrame.Angles(
					math.rad(((offset[0] ?? 0) as number) * i),
					math.rad(((offset[1] ?? 0) as number) * i),
					math.rad(((offset[2] ?? 0) as number) * i),
				));
			}

			if (options.scaleOffset && clone.IsA("BasePart")) {
				const offset = options.scaleOffset as number[];
				const currentSize = clone.Size;
				clone.Size = new Vector3(
					currentSize.X * (((offset[0] ?? 1) as number) ** i),
					currentSize.Y * (((offset[1] ?? 1) as number) ** i),
					currentSize.Z * (((offset[2] ?? 1) as number) ** i),
				);
			}

			if (options.propertyVariations) {
				for (const [propName, values] of pairs(options.propertyVariations as Record<string, unknown[]>)) {
					if (values && (values as defined[]).size() > 0) {
						const valueIndex = ((i - 1) % (values as defined[]).size());
						pcall(() => {
							(clone as unknown as { [key: string]: unknown })[propName as string] = (values as unknown[])[valueIndex];
						});
					}
				}
			}

			const targetParents = options.targetParents as string[] | undefined;
			if (targetParents && targetParents[i - 1]) {
				const targetParent = getInstanceByPath(targetParents[i - 1]);
				clone.Parent = targetParent ?? instance.Parent;
			} else {
				clone.Parent = instance.Parent;
			}

			return clone;
		});

		if (success && newInstance) {
			successCount++;
			results.push({
				success: true,
				instancePath: getInstancePath(newInstance as Instance),
				name: (newInstance as Instance).Name,
				index: i,
			});
		} else {
			failureCount++;
			results.push({ success: false, index: i, error: tostring(newInstance) });
		}
	}

	if (successCount > 0) {
		ChangeHistoryService.SetWaypoint(`Smart duplicate ${instance.Name} (${successCount} copies)`);
	}

	return {
		results,
		summary: { total: count, succeeded: successCount, failed: failureCount },
		sourceInstance: instancePath,
	};
}

function massDuplicate(requestData: Record<string, unknown>) {
	const duplications = requestData.duplications as Record<string, unknown>[];
	if (!duplications || !typeIs(duplications, "table") || (duplications as defined[]).size() === 0) {
		return { error: "Duplications array is required" };
	}

	const allResults: Record<string, unknown>[] = [];
	let totalSuccess = 0;
	let totalFailures = 0;

	for (const duplication of duplications) {
		const result = smartDuplicate(duplication) as { summary?: { succeeded: number; failed: number } };
		allResults.push(result as unknown as Record<string, unknown>);
		if (result.summary) {
			totalSuccess += result.summary.succeeded;
			totalFailures += result.summary.failed;
		}
	}

	if (totalSuccess > 0) {
		ChangeHistoryService.SetWaypoint(`Mass duplicate operations (${totalSuccess} objects)`);
	}

	return {
		results: allResults,
		summary: { total: totalSuccess + totalFailures, succeeded: totalSuccess, failed: totalFailures },
	};
}

export = {
	createObject,
	deleteObject,
	massCreateObjects,
	massCreateObjectsWithProperties,
	smartDuplicate,
	massDuplicate,
};
